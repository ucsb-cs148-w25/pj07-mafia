/*
Description:
Defines the structure and data for a voting session.
Key Responsibilities:
- Maintain voting session-specific properties (e.g., lobby ID, active players, votes).
- Store in-memory or database schema for voting sessions.
*/

class VotingSession {
    constructor(lobbyId, voteId, voteType) {
      this.lobbyId = lobbyId;
      this.voteId = voteId; // Unique identifier for each voting session
      this.voteType = voteType; // "villager" or "mafia"
      this.players = new Set(); // Players participating in this vote
      this.votes = {}; // { voterUsername: targetUsername }
      this.hasEnded = false;
    }
  }
  
  module.exports = VotingSession;