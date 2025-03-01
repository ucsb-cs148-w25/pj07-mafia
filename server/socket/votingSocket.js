const { VOTING_DURATION } = require("../constants");
const VotingService = require("../services/votingService");

// Object to track if a vote has already been ended
const endedVotes = {};

function endVotingSession(io, lobbyId, voteId, voteType) {
  // If this vote was already ended, do nothing.
  if (endedVotes[voteId]) return;

  endedVotes[voteId] = true; // mark as ended

  // Retrieve the session (if it still exists)
  const session = VotingService.getSession(lobbyId, voteId);
  if (!session) return;

  // End the voting session (VotingService.endVoting should remove the session)
  const eliminated = VotingService.endVoting(lobbyId, voteId);

  // Notify all clients that voting is complete
  io.to(lobbyId).emit("voting_complete", { eliminated });

  // Create a message regardless of whether a player was eliminated
  let msg;
  if (eliminated) {
    msg =
      voteType === "mafia"
        ? `A quiet strike in the dark… a player has been replaced by AI.`
        : `The majority has spoken… a player has been replaced by AI.`;
  } else {
    msg =
      voteType === "mafia"
        ? `An eerie silence lingers… all players remain as they are… for now.`
        : `The vote is tied. All players remain as they are… for now.`;
  }
  io.to(lobbyId).emit("message", {
    sender: "System",
    text: msg,
    timestamp: new Date()
  });
}

function initVotingSocket(io) {
  io.on("connection", (socket) => {
    console.log(`[VOTING SOCKET] ${socket.id} connected.`);

    // Handler for starting a vote
    socket.on("start_vote", ({ lobbyId, voteType }) => {
      socket.join(lobbyId);
      console.log(`[VOTING] Vote started for ${voteType} in lobby ${lobbyId}`);

      // if a voting session already exists for a lobby, do not start a new one
      const activeSessions = VotingService.getVotingSessions(lobbyId);
      if (activeSessions && activeSessions.length > 0) {
        console.log(`[VOTING] Active voting session already exists for lobby ${lobbyId}. Ignoring duplicate start_vote event.`);
        return;
      }

      // Start a new voting session
      const voteId = VotingService.startVoting(lobbyId, voteType);
      if (!voteId) {
        console.warn(`[VOTING] Failed to start voting for lobby ${lobbyId}`);
        return;
      }

      // Retrieve the newly created session
      const session = VotingService.getSession(lobbyId, voteId);
      if (!session) {
        console.warn(
          `[VOTING] Could not retrieve session for voteId ${voteId} in lobby ${lobbyId}`
        );
        return;
      }

      // Reset the ended flag for this vote
      endedVotes[voteId] = false;

      // Notify clients to open the voting interface
      io.to(lobbyId).emit("open_voting", {
        voteType,
        voteId,
        players: Array.from(session.players)
      });

      // Set a timer to auto-end the voting session after VOTING_DURATION seconds
      setTimeout(() => {
        const currentSession = VotingService.getSession(lobbyId, voteId);
        if (currentSession) {
          console.log("[TIMEOUT] Time limit reached. Ending voting session.");
          endVotingSession(io, lobbyId, voteId, voteType);
        }
      }, VOTING_DURATION * 1000);
    });

    // Handler for submitting a vote
    socket.on("submit_vote", ({ lobbyId, voteId, voter, target }) => {
      socket.join(lobbyId);
      if (!lobbyId || !voteId || !voter || !target) {
        console.warn("[VOTING] Incomplete vote submission.");
        return;
      }

      VotingService.castVote(lobbyId, voteId, voter, target);
      const session = VotingService.getSession(lobbyId, voteId);

      // If all expected votes have been received, conclude the session
      if (session && Object.keys(session.votes).length === session.voters.size) {
        console.log("[VOTING] All votes submitted. Ending voting session.");
        endVotingSession(io, lobbyId, voteId, session.voteType);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[VOTING SOCKET] ${socket.id} disconnected.`);
    });
  });
}

module.exports = { initVotingSocket };