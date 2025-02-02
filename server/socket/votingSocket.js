/*
 votingSocket.js
 Listens for "start_vote" and "submit_vote" from the client. 
 Uses VotingService to handle the logic, then broadcasts events to the lobby.
*/
const VotingService = require("../services/votingService");

function initVotingSocket(io) {
  io.on("connection", (socket) => {
    console.log(`[VOTING SOCKET] ${socket.id} connected.`);

    // Start a vote
    socket.on("start_vote", ({ lobbyId, voteType }) => {
      console.log(`[VOTING] Vote started for ${voteType} in lobby ${lobbyId}`);
      const voteId = VotingService.startVoting(lobbyId, voteType);

      if (!voteId) {
        console.warn(`[VOTING] Failed to start voting for ${lobbyId}.`);
        return;
      }

      const votingSessions = VotingService.getVotingSessions(lobbyId);
      if (!votingSessions.length) {
        console.warn(`[VOTING] No sessions found after starting voting in ${lobbyId}.`);
        return;
      }

      const latest = votingSessions[votingSessions.length - 1];
      io.to(lobbyId).emit("open_voting", {
        voteType,
        voteId,
        players: Array.from(latest.players),
      });

      // Optional 30s timer to auto-end
      setTimeout(() => {
        const session = VotingService.getSession(lobbyId, voteId);
        if (session) {
          console.log("[VOTING] Time limit reached. Closing voting session.");
          const eliminatedPlayer = VotingService.endVoting(lobbyId, voteId);
          io.to(lobbyId).emit("voting_complete", { eliminated: eliminatedPlayer });
          if (eliminatedPlayer) {
            io.to(lobbyId).emit("message", {
              sender: "System",
              text: `Player ${eliminatedPlayer} was eliminated!`,
              timestamp: new Date()
            });
          }
        }
      }, 30000);
    });

    // Submit a vote
    socket.on("submit_vote", ({ lobbyId, voteId, voter, target }) => {
      if (!lobbyId || !voteId || !voter || !target) {
        console.warn("[VOTING] Incomplete vote submission.");
        return;
      }

      VotingService.castVote(lobbyId, voteId, voter, target);

      const session = VotingService.getSession(lobbyId, voteId);
      if (session && Object.keys(session.votes).length === session.players.size) {
        // Everyone has voted
        const eliminated = VotingService.endVoting(lobbyId, voteId);
        io.to(lobbyId).emit("voting_complete", { eliminated });

        if (eliminated) {
          io.to(lobbyId).emit("message", {
            sender: "System",
            text: `Player ${eliminated} was eliminated by majority vote!`,
            timestamp: new Date()
          });
        }
      }
    });

    socket.on("disconnect", () => {
      console.log(`[VOTING SOCKET] ${socket.id} disconnected.`);
    });
  });
}

module.exports = { initVotingSocket };