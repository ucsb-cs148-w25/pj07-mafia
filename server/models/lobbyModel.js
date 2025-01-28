// server/models/lobbyModel.js
/*
lobbyModel.js
Description:
Defines the structure and data for a lobby.
Key Responsibilities:
Maintain lobby-specific properties (e.g., ID, creator, players).
Store in-memory or database schema for lobbies.
*/
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
