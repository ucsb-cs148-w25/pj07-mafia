const VotingService = require("../services/votingService");

function initVotingSocket(io) {
  io.on("connection", (socket) => {
    console.log(`[VOTING SOCKET] ${socket.id} connected.`);

    socket.on("start_vote", ({ lobbyId, voteType }) => {
      console.log(`[VOTING] Vote started for ${voteType} in lobby ${lobbyId}`);

      const voteId = VotingService.startVoting(lobbyId, voteType);
      if (!voteId) {
        console.warn(`[VOTING] Failed to start voting session for lobby ${lobbyId}`);
        return;
      }

      const votingSessions = VotingService.getVotingSessions(lobbyId);
      if (!votingSessions || votingSessions.length === 0) {
        console.warn(`[VOTING] No active voting session found for lobby ${lobbyId}`);
        return;
      }

      const latestSession = votingSessions[votingSessions.length - 1];
      // Emit the voting popup to everyone in the lobby.
      io.to(lobbyId).emit("open_voting", {
        voteType,
        voteId,
        players: Array.from(latestSession.players)
      });

      // Set a 30-second timeout to force end the voting session
      setTimeout(() => {
        const session = VotingService.getSession(lobbyId, voteId);
        if (session) {
          console.log("[VOTING] Time limit reached. Closing voting session.");
          const eliminatedPlayer = VotingService.endVoting(lobbyId, voteId);
          io.to(lobbyId).emit("voting_complete", { eliminated: eliminatedPlayer });
          if (eliminatedPlayer) {
            io.to(lobbyId).emit("chatMessage", {
              sender: "System",
              text: `Player ${eliminatedPlayer} has been eliminated!`
            });
          }
        }
      }, 30000);
    });

    socket.on("submit_vote", ({ lobbyId, voteId, voter, target }) => {
      // Guard: if any required data is missing, log and ignore.
      if (!lobbyId || !voteId || !voter || !target) {
        console.warn(
          `[VOTING] Incomplete vote submission received: lobbyId=${lobbyId}, voteId=${voteId}, voter=${voter}, target=${target}`
        );
        return;
      }
      VotingService.castVote(lobbyId, voteId, voter, target);

      // After casting the vote, check if all expected votes have been submitted.
      const session = VotingService.getSession(lobbyId, voteId);
      if (session && Object.keys(session.votes).length === session.players.size) {
        const eliminatedPlayer = VotingService.endVoting(lobbyId, voteId);
        io.to(lobbyId).emit("voting_complete", { eliminated: eliminatedPlayer });
        if (eliminatedPlayer) {
          io.to(lobbyId).emit("chatMessage", {
            sender: "System",
            text: `Player ${eliminatedPlayer} has been eliminated!`
          });
        }
      }
    });

    socket.on("disconnect", () => {
      console.log(`[SOCKET] ${socket.id} disconnected.`);
    });
  });
}

module.exports = { initVotingSocket };