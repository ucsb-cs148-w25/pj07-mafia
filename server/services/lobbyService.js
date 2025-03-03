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

// Circular dependency workaround - we'll require VotingService later
let VotingService;

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

  console.log(`[PHASE] Starting ${lobby.phase} phase in lobby ${lobbyId} with duration ${duration} seconds`);

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
      
      const oldPhase = lobby.phase;
      console.log(`[PHASE TRANSITION] Phase ${oldPhase} ended for lobby ${lobbyId}`);

      // Phase transition
      switch (lobby.phase) {
        case "day": 
          console.log(`[PHASE TRANSITION] Transitioning from day to voting in lobby ${lobbyId}`);
          lobby.phase = "voting"; 
          break;
          
        case "voting": 
          // Going into night phase - reset night phase vote tracking
          console.log(`[PHASE TRANSITION] Transitioning from voting to night in lobby ${lobbyId}`);
          lobby.phase = "night"; 
          
          if (typeof VotingService !== 'undefined' && VotingService.initializeNightPhaseVotes) {
            console.log(`[NIGHT PHASE] Initializing night phase votes for lobby ${lobbyId}`);
            try {
              VotingService.initializeNightPhaseVotes(lobbyId);
              console.log(`[NIGHT PHASE] Night phase votes initialized successfully`);
            } catch (err) {
              console.error(`[ERROR] Failed to initialize night phase votes:`, err);
            }
          } else {
            console.error(`[ERROR] VotingService or initializeNightPhaseVotes not available!`);
            console.log(`VotingService:`, VotingService);
          }
          break;
          
        case "night": 
          // End of night phase - process all night votes now
          console.log(`[PHASE TRANSITION] Transitioning from night to day in lobby ${lobbyId}`);
          console.log(`[PHASE TRANSITION] Night phase ended, processing night votes now`);
          
          // Check if voting service and finalizeNightPhase are available
          if (VotingService && VotingService.finalizeNightPhase) {
            console.log(`[DEBUG] VotingService and finalizeNightPhase are available`);
            
            try {
              // Process all night votes now
              const finalResult = processNightPhaseVotes(lobbyId, io);
              console.log(`[PHASE TRANSITION] Night phase vote processing complete:`, JSON.stringify(finalResult, null, 2));
            } catch (err) {
              console.error(`[ERROR] Error processing night phase votes:`, err);
            }
          } else {
            console.error(`[ERROR] VotingService or finalizeNightPhase not available for night phase processing!`);
            console.log(`VotingService:`, VotingService);
            console.log(`finalizeNightPhase available:`, VotingService && !!VotingService.finalizeNightPhase);
          }
          
          // Transition to day phase
          lobby.phase = "day"; 
          break;
      }
      
      console.log(`[PHASE TRANSITION] Starting new phase: ${lobby.phase} in lobby ${lobbyId}`);
      startDayNightCycle(lobbyId);
    }
  }, 1000);
}

// Process all night phase votes at the end of the night phase
function processNightPhaseVotes(lobbyId, io) {
  console.log(`[NIGHT PHASE] Starting processNightPhaseVotes for lobby ${lobbyId}`);
  console.log(`[NIGHT PHASE] VotingService reference:`, VotingService ? `Available` : `Undefined`);
  
  // Detailed check of VotingService
  if (VotingService) {
    console.log(`[NIGHT PHASE] Available VotingService methods:`, Object.keys(VotingService));
    
    // Check for active voting sessions first
    if (VotingService.getVotingSessions) {
      const activeSessions = VotingService.getVotingSessions(lobbyId);
      console.log(`[NIGHT PHASE] Active voting sessions before processing:`, 
        activeSessions.length > 0 ? activeSessions.map(s => ({
          voteType: s.voteType,
          voteId: s.voteId,
          voters: Array.from(s.voters),
          votes: s.votes ? Object.entries(s.votes).map(([voter, target]) => `${voter} → ${target}`) : []
        })) : 'none');
    }
  }
  
  // Check if we have any night votes to process
  if (!VotingService || !VotingService.finalizeNightPhase) {
    console.error(`[NIGHT PHASE ERROR] VotingService or finalizeNightPhase not available`);
    console.log(`VotingService available: ${!!VotingService}`);
    console.log(`finalizeNightPhase available: ${VotingService && !!VotingService.finalizeNightPhase}`);
    return null;
  }
  
  console.log(`[NIGHT PHASE] Calling finalizeNightPhase for ${lobbyId}`);
  
  // Process the votes - this is identical to what happens in finalizeNightPhase
  // but we're calling it explicitly at the end of the night phase
  try {
    const result = VotingService.finalizeNightPhase(lobbyId);
    console.log(`[NIGHT PHASE] finalizeNightPhase completed, returned:`, result ? JSON.stringify(result, null, 2) : "null");
  
    if (result) {
      console.log(`[NIGHT PHASE RESULTS] Processing end of night results:`, result);
      
      // Emit the appropriate message based on the mafia kill result
      let msg = "";
      if (result.eliminated) {
        msg = `A quiet strike in the dark… a player has been replaced by AI.`;
      } else if (result.saved) {
        msg = `An attack was made, but a player was saved by the Doctor.`;
      } else {
        msg = `An eerie silence lingers… all players remain as they are… for now.`;
      }
      
      // Send the public message to all players in the lobby
      if (io && msg) {
        io.to(lobbyId).emit("message", {
          sender: "System",
          text: msg,
          timestamp: new Date()
        });
      }
      
      // Send the combined voting_complete result to trigger UI cleanup
      if (io) {
        // Create a clean result object to send to client
        const resultToSend = {
          type: "mafia",
          eliminated: result.eliminated,
          saved: result.saved,
          gameStateUpdate: true  // Flag indicating this is a night-end update
        };
        
        // Send the result to all clients
        console.log(`[NIGHT END] Sending voting_complete to all clients:`, resultToSend);
        io.to(lobbyId).emit("voting_complete", resultToSend);
      }
    } else {
      console.log(`[NIGHT PHASE] No result from finalizeNightPhase`);
    }
  } catch (err) {
    console.error(`[NIGHT PHASE ERROR] Error executing finalizeNightPhase:`, err);
    return null;
  }
  
  // Re-get the result for the rest of the processing
  let finalResult = null;
  try {
    finalResult = VotingService.finalizeNightPhase(lobbyId);
  } catch (err) {
    console.error(`[NIGHT PHASE] Error re-acquiring result, skipping role processing:`, err);
    return null;
  }
  
  if (!finalResult) {
    console.warn(`[NIGHT PHASE] No valid result from finalizeNightPhase, skipping role processing`);
    return null;
  }
  
  // Process doctor results - send private confirmation to doctors
  if (finalResult.doctorAction && finalResult.doctorAction.saved) {
    const savedPlayer = finalResult.doctorAction.saved;
    const lobby = getLobby(lobbyId);
    
    console.log(`[NIGHT PHASE] Sending doctor results: saved = ${savedPlayer}`);
    
    if (lobby && io) {
      lobby.players.forEach(player => {
        if (player.isAlive && player.role && player.role.toLowerCase() === "doctor") {
          io.to(player.socketId).emit("private_message", {
            sender: "System",
            text: `You chose to save ${savedPlayer} tonight.`,
            timestamp: new Date()
          });
        }
      });
    }
    
    // Make sure saved players are not eliminated through any mechanism
    // This is a failsafe to ensure doctor saves actually work
    const mafiaTarget = finalResult.eliminated;
    if (mafiaTarget === savedPlayer) {
      // If somehow the player was marked for elimination but was also saved
      // reverse the elimination
      console.log(`[NIGHT PHASE] Saving ${savedPlayer} from elimination`);
      const lobby = getLobby(lobbyId);
      if (lobby) {
        const p = lobby.players.find((pl) => pl.username === savedPlayer);
        if (p) {
          p.isAlive = true; // ensure they're alive
        }
      }
    }
  }
  
  // Process detective results - send private messages to detectives
  if (finalResult.detectiveAction && finalResult.investigated) {
    const investigated = finalResult.investigated;
    console.log(`[NIGHT PHASE] Processing detective investigation for: ${investigated}`);
    
    const lobby = getLobby(lobbyId);
    if (lobby && io && VotingService && VotingService.getInvestigationResults) {
      const investigation = VotingService.getInvestigationResults(lobbyId);
      console.log(`[NIGHT PHASE] Detective investigation results:`, investigation);
      
      if (investigation && investigated in investigation) {
        const playerRole = investigation[investigated];
        const isMafia = playerRole.toLowerCase() === "mafia";
        const roleResult = isMafia ? "Mafia" : "not Mafia";
        
        // Send private messages to detectives
        lobby.players.forEach(player => {
          if (player.isAlive && player.role && player.role.toLowerCase() === "detective") {
            console.log(`[DETECTIVE] Sending result to detective ${player.username}: ${investigated} is ${roleResult}`);
            io.to(player.socketId).emit("private_message", {
              sender: "System",
              text: `Your investigation reveals that ${investigated} is ${roleResult}.`,
              timestamp: new Date()
            });
          }
        });
        
        // Make sure the investigated player is not eliminated by detective action
        // This is a failsafe to ensure detective investigations don't kill players
        const investigatedPlayer = lobby.players.find(p => p.username === investigated);
        if (investigatedPlayer && !investigatedPlayer.isAlive && finalResult.eliminated !== investigated) {
          // If the player was marked as eliminated by investigation, reverse it
          console.log(`[NIGHT PHASE] Reversing unintended elimination of investigated player ${investigated}`);
          investigatedPlayer.isAlive = true;
        }
      }
    }
  }
  
  return finalResult;
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

// Resolve circular dependency after exports
VotingService = require('./votingService');
