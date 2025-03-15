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
      this.voters = new Set();  // Voters in this vote
      this.votes = {}; // { voterUsername: targetUsername }
      this.hasEnded = false;

      this.doctorVotes = {};      // Map: doctor voter username -> target saved
      this.detectiveVotes = {};   // Map: detective voter username -> target investigated
      this.doctorVoters = new Set();   // Eligible doctor voters
      this.detectiveVoters = new Set(); // Eligible detective voters

      this.detectiveResultEmitted = false;
    }
  }
  
  module.exports = VotingSession;