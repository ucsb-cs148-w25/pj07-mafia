// server/services/lobbyService.js
/*
LobbyService.js
Description:
Contains business logic related to lobbies.
Key Responsibilities:
Create, join, or manage lobbies.
Validate lobby readiness to start a game.
Retrieve or update lobby details.
*/
const { v4: uuidv4 } = require('uuid');
const Lobby = require('../models/lobbyModel');
const Player = require('../models/playerModel');

const MIN_PLAYERS = 3;

// In-memory dictionary of all lobbies, keyed by lobbyId.
// In a production app, you'd likely store this in a database.
const lobbies = {};

/**
 * Helper method to retrieve a lobby from our in-memory storage.
 * @param {string} lobbyId
 * @returns {Lobby|null}
 */
function getLobby(lobbyId) {
  // Return the lobby object if it exists, otherwise null
  return lobbies[lobbyId] || null;
}

/**
 * Create a new lobby and store it in memory.
 * @param {string} socketId - The socket ID of the creator.
 * @param {string} username - The username of the creator.
 * @returns {object} - { lobbyId, players }
 */
function createLobby(socketId, username) {
  // Generate a unique ID for the lobby
  const lobbyId = uuidv4();

  // Create a new Lobby instance
  const newLobby = new Lobby(lobbyId, socketId);

  // Create a new Player instance to represent the creator
  const newPlayer = new Player(socketId, username);

  // Add this player to the lobby's player list
  newLobby.players.push(newPlayer);

  // Store this lobby in our in-memory dictionary
  lobbies[lobbyId] = newLobby;

  // Return some data for socket emission
  // For consistency, we convert Player objects to a simpler {id, name}
  return {
    lobbyId,
    players: newLobby.players.map((p) => ({
      id: p.socketId,
      name: p.username,
    })),
  };
}

/**
 * Join an existing lobby.
 * @param {string} lobbyId 
 * @param {string} socketId 
 * @param {string} username 
 * @returns {array} - Updated list of players in the lobby (as {id, name} objects).
 */
function joinLobby(lobbyId, socketId, username) {
  const lobby = getLobby(lobbyId);
  if (!lobby) {
    throw new Error('Lobby not found');
  }

  // Optionally, you might want to check if username is already taken in this lobby
  // if (lobby.players.some((p) => p.username === username)) {
  //   throw new Error('Username already taken in this lobby.');
  // }

  // Create a new Player instance
  const newPlayer = new Player(socketId, username);
  lobby.players.push(newPlayer);

  // Return updated players for the socket emission
  return lobby.players.map((p) => ({
    id: p.socketId,
    name: p.username,
  }));
}

/**
 * Check if a lobby can start (e.g., has enough players and hasn't started yet).
 * @param {string} lobbyId
 * @returns {boolean}
 */
function canStart(lobbyId) {
  const lobby = getLobby(lobbyId);
  if (!lobby) return false;

  return lobby.players.length >= MIN_PLAYERS && !lobby.hasStarted;
}



/**
 * Remove a disconnected player from a lobby.
 * If that player was the creator, reassign or delete the lobby.
 * @param {string} socketId 
 * @returns {object|null}
 */
function removePlayer(socketId) {
  for (const lobbyId in lobbies) {
    const lobby = lobbies[lobbyId];

    // Find the index of the player in that lobby
    const playerIndex = lobby.players.findIndex(
      (p) => p.socketId === socketId
    );

    if (playerIndex !== -1) {
      const removedPlayer = lobby.players.splice(playerIndex, 1)[0];
      console.log(
        `Removed player: ${removedPlayer.username}, socket: ${socketId}, from lobby: ${lobbyId}`
      );

      // If the disconnected player was the lobby creator, handle reassign or destroy
      if (lobby.creator === socketId) {
        if (lobby.players.length > 0) {
          // Assign a new creator (just pick the first player in the array)
          lobby.creator = lobby.players[0].socketId;
          return {
            lobbyId,
            players: lobby.players.map((p) => ({
              id: p.socketId,
              name: p.username,
            })),
            newCreator: lobby.creator,
          };
        } else {
          // No players left; remove the lobby entirely
          delete lobbies[lobbyId];
          return { lobbyId, players: [] };
        }
      }

      // If not the creator, just return the updated list
      return {
        lobbyId,
        players: lobby.players.map((p) => ({
          id: p.socketId,
          name: p.username,
        })),
      };
    }
  }
  // If we didn't find the player in any lobby, return null
  return null;
}

module.exports = {
  getLobby,
  createLobby,
  joinLobby,
  canStart,
  removePlayer,
};