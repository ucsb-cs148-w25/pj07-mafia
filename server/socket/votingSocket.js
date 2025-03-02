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
  const result = VotingService.endVoting(lobbyId, voteId);

  if (!result) return;
  
  // If this is a pending result (night phase votes that need to be combined)
  // Only emit the final result
  if (result.pending) {
    return;
  }

  // Handle different vote types
  let msg = "";
  let socketResponse = {};

  switch (result.type) {
    case "mafia":
      socketResponse = { 
        type: "mafia", 
        eliminated: result.eliminated,
        saved: result.saved
      };
      
      if (result.eliminated) {
        msg = `A quiet strike in the dark… a player has been replaced by AI.`;
      } else if (result.saved) {
        // Only Mafia and Doctor should know who was saved
        msg = `An attack was made, but a player was saved by the Doctor.`;
      } else {
        msg = `An eerie silence lingers… all players remain as they are… for now.`;
      }
      break;
      
    case "doctor":
      socketResponse = { type: "doctor", saved: result.saved };
      // Send a private confirmation only to the doctor(s)
      const doctorLobby = VotingService.getLobby(lobbyId);
      if (doctorLobby && result.saved) {
        doctorLobby.players.forEach(player => {
          if (player.isAlive && player.role && player.role.toLowerCase() === "doctor") {
            io.to(player.socketId).emit("private_message", {
              sender: "System",
              text: `You have chosen to save ${result.saved} tonight.`,
              timestamp: new Date()
            });
          }
        });
      }
      break;
      
    case "detective":
      socketResponse = { type: "detective", investigated: result.investigated };
      // Private message for detective is sent in the special handler below
      break;
      
    case "villager":
      socketResponse = { type: "villager", eliminated: result.eliminated };
      
      if (result.eliminated) {
        msg = `The majority has spoken… a player has been replaced by AI.`;
      } else {
        msg = `The vote is tied. All players remain as they are… for now.`;
      }
      break;
      
    default:
      break;
  }

  // Notify all clients that voting is complete
  io.to(lobbyId).emit("voting_complete", socketResponse);

  // Only send a system message if there's something to report to everyone
  if (msg) {
    io.to(lobbyId).emit("message", {
      sender: "System",
      text: msg,
      timestamp: new Date()
    });
  }
  
  // Send private messages to roles that need them
  if (result.type === "detective" && result.investigated) {
    // Find detectives to send the private message
    const lobby = VotingService.getLobby(lobbyId);
    if (lobby) {
      const investigatedPlayer = lobby.players.find(p => p.username === result.investigated);
      if (investigatedPlayer) {
        const role = investigatedPlayer.role || "Unknown";
        
        // Determine if the player is Mafia or not (for simplicity in the game)
        const isMafia = role.toLowerCase() === "mafia";
        const roleResult = isMafia ? "Mafia" : "not Mafia";
        
        lobby.players.forEach(player => {
          if (player.isAlive && player.role && player.role.toLowerCase() === "detective") {
            // Send private investigation result only to detectives
            io.to(player.socketId).emit("private_message", {
              sender: "System",
              text: `Your investigation reveals that ${result.investigated} is ${roleResult}.`,
              timestamp: new Date()
            });
          }
        });
      }
    }
  }
}

function initVotingSocket(io) {
  io.on("connection", (socket) => {
    console.log(`[VOTING SOCKET] ${socket.id} connected.`);

    // Handler for starting a vote
    socket.on("start_vote", ({ lobbyId, voteType }) => {
      socket.join(lobbyId);
      console.log(`[VOTING] Vote started for ${voteType} in lobby ${lobbyId}`);

      // Check if a voting session of this type already exists
      const activeSessions = VotingService.getVotingSessions(lobbyId);
      const existingSessionOfType = activeSessions.find(session => session.voteType === voteType);
      
      if (existingSessionOfType) {
        console.log(`[VOTING] Active ${voteType} voting session already exists for lobby ${lobbyId}. Ignoring duplicate start_vote event.`);
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

      console.log(`[VOTING] Processing vote from ${voter} for ${target} (voteId: ${voteId})`);
      
      VotingService.castVote(lobbyId, voteId, voter, target);
      const session = VotingService.getSession(lobbyId, voteId);
      
      if (session) {
        console.log(`[VOTING] Session ${voteId} has ${Object.keys(session.votes).length} votes (out of ${session.voters.size} needed)`);
      }

      // If all expected votes have been received, conclude the session
      if (session && Object.keys(session.votes).length === session.voters.size) {
        console.log(`[VOTING] All votes submitted for ${session.voteType}. Ending voting session.`);
        // Slight delay to ensure all messages are processed
        setTimeout(() => {
          endVotingSession(io, lobbyId, voteId, session.voteType);
        }, 100);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[VOTING SOCKET] ${socket.id} disconnected.`);
    });
  });
}

module.exports = { initVotingSocket };