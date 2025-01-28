// server/models/playerModel.js
/*
playerModel.js
Description:
Defines the structure and data for a player.
Key Responsibilities:
Store player details (e.g., username, socket ID, role).
Associate players with specific lobbies.
*/
class Player {
  constructor(socketId, username) {
    this.socketId = socketId;
    this.username = username;
    // Potentially more fields, like role, isAlive, etc.
  }
}

module.exports = Player;