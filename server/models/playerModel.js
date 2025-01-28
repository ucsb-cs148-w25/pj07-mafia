// server/models/playerModel.js
class Player {
  constructor(socketId, username) {
    this.socketId = socketId;
    this.username = username;
    // Potentially more fields, like role, isAlive, etc.
  }
}

module.exports = Player;