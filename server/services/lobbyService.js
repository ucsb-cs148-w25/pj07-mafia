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
