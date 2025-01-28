// server/models/lobbyModel.js

/**
 * Represents a game lobby.
 * 
 * In a real database scenario, you'd have a schema (e.g. Mongoose, Sequelize).
 * For now, this is a simple class used in-memory by the lobbyService.
 */
class Lobby {
  constructor(id, creator) {
    this.id = id;
    this.creator = creator;
    this.players = [];
    this.hasStarted = false;
  }
}

module.exports = Lobby;
