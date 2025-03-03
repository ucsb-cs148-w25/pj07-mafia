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
  
  // CRITICAL: Night phase votes should NEVER be immediately processed
  // They should only be processed at the end of the night phase
  if (voteType === "doctor" || voteType === "detective" || voteType === "mafia") {
    // Log but don't actually end the session or process results
    console.log(`[VOTING] Night phase vote ${voteType} should not be ended here! Ignoring endVotingSession call.`);
    console.log(`[VOTING] Night vote results will be processed at end of night phase only`);
    
    // Do NOT call endVoting here - night phase votes should be processed together at end of night
    // Also, don't emit any events or messages
    return;
  }
  
  // For other vote types with pending results, also don't process yet
  if (result && result.pending) {
    console.log(`[VOTING] Vote result marked as pending, will process later`);
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

      console.log(`[VOTING] Vote submitted: ${voter} voting for ${target} in session ${voteId} (${lobbyId})`);
      
      // Get the session before casting the vote
      const sessionBefore = VotingService.getSession(lobbyId, voteId);
      if (!sessionBefore) {
        console.warn(`[VOTING] No voting session found for voteId ${voteId} in lobby ${lobbyId}`);
        return;
      }
      
      // Record what type of vote this is
      const voteType = sessionBefore.voteType;
      console.log(`[VOTE SUBMISSION] ${voteType.toUpperCase()} vote from ${voter} targeting ${target}`);
      
      // Cast the vote
      VotingService.castVote(lobbyId, voteId, voter, target);
      
      // Get the session after casting the vote
      const session = VotingService.getSession(lobbyId, voteId);
      if (!session) {
        console.warn(`[VOTING] Session disappeared after casting vote! voteId: ${voteId}, lobbyId: ${lobbyId}`);
        return;
      }
      
      // Log the session state after casting the vote
      console.log(`[VOTE TRACKING] After vote cast, session has ${Object.keys(session.votes).length} votes (out of ${session.voters.size} needed)`);
      console.log(`[VOTE TRACKING] Vote details:`, JSON.stringify(session.votes, null, 2));
      
      // CRITICAL: For night phase roles, NEVER auto-end the voting session
      // Only end voting sessions for day/villager votes immediately
      if (voteType === "villager") {
        if (Object.keys(session.votes).length === session.voters.size) {
          // Only auto-end daytime/villager votes when all votes are in
          console.log(`[VOTING] All villager votes submitted. Ending voting session.`);
          // Slight delay to ensure all messages are processed
          setTimeout(() => {
            endVotingSession(io, lobbyId, voteId, voteType);
          }, 100);
        }
      } else {
        // For night phase roles (mafia, doctor, detective), confirm receipt but DON'T end session
        console.log(`[NIGHT VOTE] ${voteType} vote from ${voter} recorded. Will process at end of night phase.`);
        
        // Send a private acknowledgment back to the voter
        socket.emit("vote_acknowledged", {
          voteType: voteType,
          message: `Your ${voteType} vote for ${target} has been recorded.`
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[VOTING SOCKET] ${socket.id} disconnected.`);
    });
  });
}

module.exports = { initVotingSocket };