// server/services/lobbyService.js
/*
LobbyService.js
Description:
Contains business logic related to lobbies.
*/

const { v4: uuidv4 } = require('uuid');
const Lobby = require('../models/lobbyModel');
const Player = require('../models/playerModel');
const { 
  DAY_DURATION, 
  VOTING_DURATION, 
  NIGHT_DURATION, 
  MIN_PLAYERS, 
  MAX_PLAYERS 
} = require('../constants'); 

const lobbies = {};
let io = null;

function initialize(socketIO) {
  io = socketIO;
}

function getLobby(lobbyId) {
  return lobbies[lobbyId] || null;
}

function createLobby(socketId, username) {
  const lobbyId = uuidv4();
  const newLobby = new Lobby(lobbyId, socketId);
  const newPlayer = new Player(socketId, username);
  newLobby.players.push(newPlayer);

  lobbies[lobbyId] = newLobby;

  return {
    lobbyId,
    players: newLobby.players.map((p) => ({
      id: p.socketId,
      name: p.username,
    })),
  };
}

function joinLobby(lobbyId, socketId, username) {
  const lobby = getLobby(lobbyId);
  if (!lobby) throw new Error('Lobby not found');
  if (lobby.hasStarted) throw new Error('Game has already started'); // or allow if you want
  if (lobby.players.length >= MAX_PLAYERS) throw new Error('Lobby is full');

  const newPlayer = new Player(socketId, username);
  lobby.players.push(newPlayer);

  return lobby.players.map((p) => ({
    id: p.socketId,
    name: p.username,
  }));
}

function canStart(lobbyId) {
  const lobby = getLobby(lobbyId);
  if (!lobby) return false;
  // Example logic: need at least MIN_PLAYERS, and not started
  return lobby.players.length >= MIN_PLAYERS && !lobby.hasStarted;
}

function startGame(lobbyId, socketId) {
  const lobby = getLobby(lobbyId);
  if (!lobby) throw new Error('Lobby not found');
  if (socketId !== lobby.creator) throw new Error('Only the lobby creator can start');
  if (lobby.hasStarted) throw new Error('Game has already started');

  // Possibly check min players
  // if (lobby.players.length < MIN_PLAYERS) { throw new Error(...) }

  lobby.hasStarted = true;
  lobby.phase = "day";
}

function startDayNightCycle(lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;

  let duration = 0;
  switch (lobby.phase) {
    case "day": duration = DAY_DURATION; break;
    case "voting": duration = VOTING_DURATION; break;
    case "night": duration = NIGHT_DURATION; break;
    default: duration = DAY_DURATION; break;
  }

  lobby.timeLeft = duration;
  if (lobby.timer) clearInterval(lobby.timer);

  lobby.timer = setInterval(() => {
    lobby.timeLeft--;
    io.to(lobbyId).emit("phaseUpdate", {
      phase: lobby.phase,
      timeLeft: lobby.timeLeft,
    });

    if (lobby.timeLeft <= 0) {
      clearInterval(lobby.timer);
      lobby.timer = null;

      // If night phase is ending, process any pending night votes
      if (lobby.phase === "night") {
        // We need to check if any night votes are pending
        try {
          const votingService = require('./votingService');
          const votingSocket = require('../socket/votingSocket');
          
          // Clear any lingering voting sessions first
          const activeSessions = votingService.getVotingSessions(lobbyId) || [];
          console.log(`[LOBBY] Clearing ${activeSessions.length} remaining voting sessions at night end`);
          
          // Remove all remaining voting sessions
          votingService.clearVotingSessions(lobbyId);
          
          // Check if night results have already been processed
          if (!votingSocket.processedNightResults[lobbyId]) {
            // Process night results if they haven't been processed yet
            console.log("[LOBBY] Night phase ended, processing results");
            const nightVotes = votingService.nightVotes[lobbyId] || { mafia: null, doctor: null, detective: null };
            console.log("[LOBBY] Current night votes:", nightVotes);
            
            // IMPORTANT: Process doctor save vs mafia kill
            let eliminatedPlayer = null;
            if (nightVotes.mafia && nightVotes.doctor && nightVotes.mafia === nightVotes.doctor) {
              console.log(`[LOBBY] Doctor saved ${nightVotes.mafia} from elimination`);
              eliminatedPlayer = null; // Doctor saved the player
            } else if (nightVotes.mafia) {
              eliminatedPlayer = nightVotes.mafia;
              
              // Mark player as eliminated in the lobby
              const targetPlayer = lobby.players.find(p => p.username === eliminatedPlayer);
              if (targetPlayer) {
                targetPlayer.isAlive = false;
                console.log(`[LOBBY] Player ${eliminatedPlayer} was eliminated by Mafia`);
              }
            }
            
            // Broadcast night results to all clients
            io.to(lobbyId).emit("voting_complete", { 
              eliminated: eliminatedPlayer,
              voteType: "night_results"
            });
            
            // Send system message about elimination or no elimination
            let msg;
            if (eliminatedPlayer) {
              msg = `A quiet strike in the dark… a player has been replaced by AI.`;
            } else {
              msg = `An eerie silence lingers… all players remain as they are… for now.`;
            }
            
            io.to(lobbyId).emit("message", {
              sender: "System",
              text: msg,
              timestamp: new Date()
            });
            
            // Mark night results as processed
            votingSocket.processedNightResults[lobbyId] = true;
          } else {
            console.log(`[LOBBY] Night results already processed for lobby ${lobbyId}, skipping`);
          }
          
          // Reset night votes for next night phase
          votingService.nightVotes[lobbyId] = { mafia: null, doctor: null, detective: null };
          
        } catch (error) {
          console.error("Error processing night votes:", error);
        }
      }

      // Reset any previously processed night results flag when changing phases
      if (lobby.phase === "night") {
        try {
          const votingSocket = require('../socket/votingSocket');
          if (votingSocket.resetProcessedNightResults) {
            votingSocket.resetProcessedNightResults(lobbyId);
          }
        } catch (error) {
          console.error("Error resetting processed night results:", error);
        }
      }

      switch (lobby.phase) {
        case "day": lobby.phase = "voting"; break;
        case "voting": lobby.phase = "night"; break;
        case "night": lobby.phase = "day"; break;
      }
      startDayNightCycle(lobbyId);
    }
  }, 1000);
}

function removePlayer(socketId) {
  for (const lid in lobbies) {
    const lobby = lobbies[lid];
    const idx = lobby.players.findIndex(p => p.socketId === socketId);
    if (idx !== -1) {
      const removed = lobby.players.splice(idx, 1)[0];
      console.log(`Removed ${removed.username} from ${lid}`);

      if (lobby.creator === socketId) {
        if (lobby.players.length > 0) {
          lobby.creator = lobby.players[0].socketId;
          return {
            lobbyId: lid,
            players: lobby.players.map((p) => ({
              id: p.socketId,
              name: p.username,
            })),
            newCreator: lobby.creator,
          };
        } else {
          delete lobbies[lid];
          return { lobbyId: lid, players: [] };
        }
      }

      return {
        lobbyId: lid,
        players: lobby.players.map((p) => ({
          id: p.socketId,
          name: p.username,
        })),
      };
    }
  }
  return null;
}

module.exports = {
  initialize,
  getLobby,
  createLobby,
  joinLobby,
  canStart,          // <-- Our service-level function
  startGame,
  startDayNightCycle,
  removePlayer,
};
