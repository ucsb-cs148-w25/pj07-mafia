// Mock the lobbyService to control the lobby data
jest.mock("../../server/services/lobbyService", () => ({
    getLobby: jest.fn(),
  }));
  
  let votingService, lobbyService;
  
  beforeEach(() => {
    // Reset module state between tests.
    jest.resetModules();
    votingService = require("../../server/services/votingService");
    lobbyService = require("../../server/services/lobbyService");
  });
  
  describe("startVoting", () => {
    it("should return null if lobby does not exist", () => {
      lobbyService.getLobby.mockReturnValue(null);
      const voteId = votingService.startVoting("nonExistentLobby", "mafia");
      expect(voteId).toBeNull();
    });
  
    describe("mafia vote", () => {
      let lobby;
      beforeEach(() => {
        lobby = {
          players: [
            { username: "mafia1", isAlive: true, role: "Mafia" },
            { username: "mafia2", isAlive: true, role: "Mafia" },
            { username: "villager1", isAlive: true, role: "Villager" },
            { username: "deadMafia", isAlive: false, role: "Mafia" }
          ]
        };
        lobbyService.getLobby.mockReturnValue(lobby);
      });
  
      it("should include only alive mafia players", () => {
        const voteId = votingService.startVoting("lobby1", "mafia");
        const session = votingService.getSession("lobby1", voteId);
        expect(session).not.toBeNull();
        expect(session.players.has("mafia1")).toBe(true);
        expect(session.players.has("mafia2")).toBe(true);
        expect(session.players.has("villager1")).toBe(false);
        expect(session.players.has("deadMafia")).toBe(false);
      });
  
      it("should exclude players that have already been eliminated", () => {
        // Create a lobby with three mafia players.
        lobby.players = [
          { username: "mafia1", isAlive: true, role: "Mafia" },
          { username: "mafia2", isAlive: true, role: "Mafia" },
          { username: "mafia3", isAlive: true, role: "Mafia" }
        ];
        // Start a voting session and simulate mafia2 and mafia3 voting for mafia1.
        const voteId = votingService.startVoting("lobby1", "mafia");
        votingService.castVote("lobby1", voteId, "mafia2", "mafia1");
        votingService.castVote("lobby1", voteId, "mafia3", "mafia1");
        // End voting so that mafia1 gets eliminated.
        const eliminated = votingService.endVoting("lobby1", voteId);
        expect(eliminated).toBe("mafia1");
  
        // Start a new mafia voting session – mafia1 should not be eligible.
        const voteId2 = votingService.startVoting("lobby1", "mafia");
        const session2 = votingService.getSession("lobby1", voteId2);
        expect(session2.players.has("mafia1")).toBe(false);
        expect(session2.players.has("mafia2")).toBe(true);
        expect(session2.players.has("mafia3")).toBe(true);
      });
    });
  
    describe("villager vote", () => {
      let lobby;
      beforeEach(() => {
        lobby = {
          players: [
            { username: "mafia1", isAlive: true, role: "Mafia" },
            { username: "villager1", isAlive: true, role: "Villager" },
            { username: "newJoiner", isAlive: true, role: null },
            { username: "deadPlayer", isAlive: false, role: "Villager" }
          ]
        };
        lobbyService.getLobby.mockReturnValue(lobby);
      });
  
      it("should include all alive players regardless of role", () => {
        const voteId = votingService.startVoting("lobby2", "villager");
        const session = votingService.getSession("lobby2", voteId);
        expect(session).not.toBeNull();
        expect(session.players.has("mafia1")).toBe(true);
        expect(session.players.has("villager1")).toBe(true);
        expect(session.players.has("newJoiner")).toBe(true);
        expect(session.players.has("deadPlayer")).toBe(false);
      });
    });
  });
  
  describe("castVote", () => {
    let lobby;
    beforeEach(() => {
      lobby = {
        players: [
          { username: "player1", isAlive: true, role: "Villager" },
          { username: "player2", isAlive: true, role: "Villager" },
          { username: "player3", isAlive: true, role: "Villager" }
        ]
      };
      lobbyService.getLobby.mockReturnValue(lobby);
    });
  
    it("should record a valid vote", () => {
      const voteId = votingService.startVoting("lobby3", "villager");
      votingService.castVote("lobby3", voteId, "player1", "player2");
      const session = votingService.getSession("lobby3", voteId);
      expect(session.votes["player1"]).toBe("player2");
    });
  
    it("should not allow duplicate votes", () => {
      const voteId = votingService.startVoting("lobby3", "villager");
      votingService.castVote("lobby3", voteId, "player1", "player2");
      // Attempt a duplicate vote from player1.
      votingService.castVote("lobby3", voteId, "player1", "player3");
      const session = votingService.getSession("lobby3", voteId);
      expect(session.votes["player1"]).toBe("player2");
    });
  
    it("should not record a vote if the voter is not eligible", () => {
      const voteId = votingService.startVoting("lobby3", "villager");
      // 'nonExistent' is not in the session.players set.
      votingService.castVote("lobby3", voteId, "nonExistent", "player2");
      const session = votingService.getSession("lobby3", voteId);
      expect(session.votes["nonExistent"]).toBeUndefined();
    });
  
    it("should not record a vote if the target is not eligible", () => {
      const voteId = votingService.startVoting("lobby3", "villager");
      // 'nonExistent' is not in the session.players set.
      votingService.castVote("lobby3", voteId, "player1", "nonExistent");
      const session = votingService.getSession("lobby3", voteId);
      expect(session.votes["player1"]).toBeUndefined();
    });
  
    it("should warn and not record a vote if the session does not exist", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      votingService.castVote("lobbyX", "nonExistentVote", "player1", "player2");
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
  
  describe("calculateResults and endVoting", () => {
    let lobby;
    beforeEach(() => {
      lobby = {
        players: [
          { username: "player1", isAlive: true, role: "Villager" },
          { username: "player2", isAlive: true, role: "Villager" },
          { username: "player3", isAlive: true, role: "Villager" }
        ]
      };
      lobbyService.getLobby.mockReturnValue(lobby);
    });
  
    it("should return null for a tie vote", () => {
      const voteId = votingService.startVoting("lobby4", "villager");
      // Create a tie: player1 votes for player2 and player2 votes for player1.
      votingService.castVote("lobby4", voteId, "player1", "player2");
      votingService.castVote("lobby4", voteId, "player2", "player1");
      // Player3 abstains.
      const eliminated = votingService.endVoting("lobby4", voteId);
      expect(eliminated).toBeNull();
      // The session should be removed.
      const session = votingService.getSession("lobby4", voteId);
      expect(session).toBeNull();
      // Verify that no player's alive status was changed.
      expect(lobby.players.find(p => p.username === "player1").isAlive).toBe(true);
      expect(lobby.players.find(p => p.username === "player2").isAlive).toBe(true);
      expect(lobby.players.find(p => p.username === "player3").isAlive).toBe(true);
    });
  
    it("should eliminate the player with majority votes", () => {
      const voteId = votingService.startVoting("lobby5", "villager");
      // Voting scenario: player1 and player3 vote for player2, while player2 votes for player1.
      votingService.castVote("lobby5", voteId, "player1", "player2");
      votingService.castVote("lobby5", voteId, "player3", "player2");
      votingService.castVote("lobby5", voteId, "player2", "player1");
      const eliminated = votingService.endVoting("lobby5", voteId);
      expect(eliminated).toBe("player2");
      // The session should be removed.
      const session = votingService.getSession("lobby5", voteId);
      expect(session).toBeNull();
      // Verify that player2 is now marked as not alive.
      const p2 = lobby.players.find(p => p.username === "player2");
      expect(p2.isAlive).toBe(false);
    });
  
    it("should return null when ending a non-existent session", () => {
      const result = votingService.endVoting("nonExistentLobby", "nonExistentVote");
      expect(result).toBeNull();
    });
  });
  
  describe("getVotingSessions and getSession", () => {
    let lobby;
    beforeEach(() => {
      lobby = {
        players: [
          { username: "player1", isAlive: true, role: "Villager" },
          { username: "player2", isAlive: true, role: "Villager" }
        ]
      };
      lobbyService.getLobby.mockReturnValue(lobby);
    });
  
    it("should return all active voting sessions for a lobby", () => {
      const voteId1 = votingService.startVoting("lobby6", "villager");
      const voteId2 = votingService.startVoting("lobby6", "villager");
      const sessions = votingService.getVotingSessions("lobby6");
      expect(sessions.length).toBe(2);
      // Verify that each session can be individually retrieved.
      const session1 = votingService.getSession("lobby6", voteId1);
      const session2 = votingService.getSession("lobby6", voteId2);
      expect(session1).not.toBeNull();
      expect(session2).not.toBeNull();
    });
  
    it("should return null for a non-existent session", () => {
      const session = votingService.getSession("lobby6", "nonExistentVote");
      expect(session).toBeNull();
    });
  });