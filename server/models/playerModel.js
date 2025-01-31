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
  constructor(socketId, username, role = null) {
    this.socketId = socketId;
    this.username = username;
    this.role = role; // Add role property
    this.isAlive = true; // Optional: Track player status
    this.vote = '';
    this.voteCount = 0;
  }
}

module.exports = Player;