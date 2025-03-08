const { VOTING_DURATION, NIGHT_DURATION } = require("../constants");
const VotingService = require("../services/votingService");

// Object to track if a vote has already been ended
const endedVotes = {};
const processedNightResults = {}; // Track if night results have been processed for a lobby

// Process night results when all roles have voted
function processNightResults(io, lobbyId) {
  // If we've already processed night results for this cycle, don't do it again
  if (processedNightResults[lobbyId]) {
    console.log(`[VOTING] Night results already processed for lobby ${lobbyId}`);
    return;
  }
  
  // Mark as processed to prevent duplicate processing
  processedNightResults[lobbyId] = true;
  
  // Get the night votes
  const nightVotes = VotingService.nightVotes[lobbyId] || { mafia: null, doctor: null, detective: null };
  console.log("[VOTING] Processing night results for votes:", nightVotes);
  
  // Process doctor save vs mafia kill
  let eliminatedPlayer = null;
  if (nightVotes.mafia && nightVotes.doctor && nightVotes.mafia === nightVotes.doctor) {
    console.log(`[VOTING] Doctor saved ${nightVotes.mafia} from elimination`);
    eliminatedPlayer = null; // Doctor saved the player
  } else if (nightVotes.mafia) {
    eliminatedPlayer = nightVotes.mafia;
    
    // Mark player as eliminated in the lobby
    const lobby = VotingService.getLobby(lobbyId);
    if (lobby) {
      const targetPlayer = lobby.players.find(p => p.username === eliminatedPlayer);
      if (targetPlayer) {
        targetPlayer.isAlive = false;
        console.log(`[VOTING] Player ${eliminatedPlayer} was eliminated by Mafia`);
      }
    }
  }
  
  // Broadcast night results to all clients
  io.to(lobbyId).emit("voting_complete", { 
    eliminated: eliminatedPlayer,
    voteType: "night_results"
  });
  
  // Send system message about elimination or no elimination
  let msg;
  if (eliminatedPlayer) {
    msg = `A quiet strike in the dark… a player has been replaced by AI.`;
  } else {
    msg = `An eerie silence lingers… all players remain as they are… for now.`;
  }
  
  io.to(lobbyId).emit("message", {
    sender: "System",
    text: msg,
    timestamp: new Date()
  });
  
  // Clear all remaining voting sessions
  VotingService.clearVotingSessions(lobbyId);
  
  // After a brief delay, reset the night votes and processed flag for the next night
  setTimeout(() => {
    VotingService.nightVotes[lobbyId] = { mafia: null, doctor: null, detective: null };
    delete processedNightResults[lobbyId];
    console.log(`[VOTING] Reset night votes for lobby ${lobbyId} for next night phase`);
  }, 1000);
}

function endVotingSession(io, lobbyId, voteId, voteType) {
  // If this vote was already ended, do nothing.
  if (endedVotes[voteId]) return;

  endedVotes[voteId] = true; // mark as ended

  // Retrieve the session (if it still exists)
  const session = VotingService.getSession(lobbyId, voteId);
  if (!session) return;

  // End the voting session (VotingService.endVoting should remove the session)
  const result = VotingService.endVoting(lobbyId, voteId);

  // Special handling for different vote types
  if (result && typeof result === 'object' && result.type) {
    // Handle detective investigation result
    if (result.type === 'detective') {
      console.log("[VOTING] Processing detective investigation result");
      
      // Send the detective result to all sockets, but make it a private message
      // This ensures the detective will see it without having to match exact socket
      console.log(`[VOTING] Preparing to send investigation result to detective ${result.detective}`);
      const roleReveal = result.isMafia ? "is a Mafia member" : "is not a Mafia member";
      const detectiveMsg = {
        sender: "System",
        text: `Your investigation reveals that ${result.target} ${roleReveal}.`,
        timestamp: new Date(),
        isPrivate: true,
        forUsername: result.detective  // Add target username 
      };
      
      // Send to everyone in the lobby, and let clients filter
      io.to(lobbyId).emit("detective_result", detectiveMsg);
      
      // IMPORTANT: Don't set eliminated player for detective votes!
      // This was causing players to be eliminated when they were investigated
      return; // Don't continue with normal elimination logic
    }
    
    // Handle night results
    if (result.type === 'night_results') {
      // Notify all clients that night voting is complete
      io.to(lobbyId).emit("voting_complete", { eliminated: result.eliminated });
      
      // Create a message based on night results
      let msg;
      if (result.eliminated) {
        msg = `A quiet strike in the dark… a player has been replaced by AI.`;
      } else {
        msg = `An eerie silence lingers… all players remain as they are… for now.`;
      }
      
      io.to(lobbyId).emit("message", {
        sender: "System",
        text: msg,
        timestamp: new Date()
      });
      return;
    }
  }
  
  // Handle regular voting results (day phase or standalone mafia vote)
  const eliminated = result;
  
  // Notify all clients that voting is complete
  io.to(lobbyId).emit("voting_complete", { eliminated });

  // Only send a system message for day phase voting or if it's a standalone mafia vote
  // (Doctor and Detective votes don't need system messages)
  if (voteType === "villager" || voteType === "mafia") {
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
}

function initVotingSocket(io) {
  io.on("connection", (socket) => {
    console.log(`[VOTING SOCKET] ${socket.id} connected.`);
    
    // Store username in socket for private messages
    socket.on("joinChatroom", ({ lobbyId, username }, callback) => {
      if (username) {
        socket.username = username;
        console.log(`[VOTING] Stored username ${username} for socket ${socket.id}`);
      }
    });
    
    // We'll capture the username in submit_vote handler

    // Handler for starting a vote
    socket.on("start_vote", ({ lobbyId, voteType }) => {
      socket.join(lobbyId);
      console.log(`[VOTING] Vote started for ${voteType} in lobby ${lobbyId}`);

      // Check if a voting session already exists of the same type 
      const activeSessions = VotingService.getVotingSessions(lobbyId);
      if (activeSessions && activeSessions.length > 0) {
        // Check for existing session of the same type
        const existingSessionOfSameType = activeSessions.find(
          session => session.voteType === voteType
        );
        
        if (existingSessionOfSameType) {
          // For night votes, we'll reset the session to allow voting in new night phases
          if (voteType === "mafia" || voteType === "doctor" || voteType === "detective") {
            console.log(`[VOTING] Removing existing ${voteType} voting session for new night phase`);
            
            // Find and remove the existing session
            const sessionIndex = activeSessions.findIndex(session => session.voteType === voteType);
            if (sessionIndex >= 0) {
              VotingService.removeVotingSession(lobbyId, sessionIndex);
            }
          } else {
            console.log(`[VOTING] Active ${voteType} voting session already exists for lobby ${lobbyId}. Ignoring duplicate start_vote event.`);
            return;
          }
        }
        
        // For day phase votes, we should only have one active vote session
        if (voteType === "villager") {
          const villagerSession = activeSessions.find(session => session.voteType === "villager");
          if (villagerSession) {
            console.log(`[VOTING] Active villager voting session already exists for lobby ${lobbyId}. Ignoring duplicate start_vote event.`);
            return;
          }
        }
      }
      
      // At the start of night phase, reset the night votes
      if (voteType === "mafia" || voteType === "doctor" || voteType === "detective") {
        if (!VotingService.nightVotes[lobbyId]) {
          VotingService.nightVotes[lobbyId] = { mafia: null, doctor: null, detective: null };
        }
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
      }, voteType !== "villager" ? (NIGHT_DURATION * 1000) : (VOTING_DURATION * 1000));
    });

    // Handler for submitting a vote
    socket.on("submit_vote", ({ lobbyId, voteId, voter, target, voterRole, voteType: clientVoteType }) => {
      socket.join(lobbyId);
      if (!lobbyId || !voteId || !voter || !target) {
        console.warn("[VOTING] Incomplete vote submission.");
        return;
      }
      
      // Store username in socket for detective messages
      if (voter && !socket.username) {
        socket.username = voter;
        console.log(`[VOTING] Captured username ${voter} from vote submission for socket ${socket.id}`);
      }

      // Get the session BEFORE casting vote to get the vote type
      const sessionBeforeVote = VotingService.getSession(lobbyId, voteId);
      
      // Use client-provided vote type if available, or try to get it from session
      let voteType = clientVoteType;
      
      // If no explicit vote type, try to get it from session
      if (!voteType && sessionBeforeVote) {
        voteType = sessionBeforeVote.voteType;
      }
      
      // If still no vote type, try to infer from the voteId or voterRole
      if (!voteType) {
        if (voteId.startsWith('mafia_')) voteType = 'mafia';
        else if (voteId.startsWith('doctor_')) voteType = 'doctor';
        else if (voteId.startsWith('detective_')) voteType = 'detective';
        else if (voterRole) voteType = voterRole.toLowerCase();
      }
      
      // If we still can't determine vote type, log error and return
      if (!voteType) {
        console.warn(`[VOTING] Could not determine vote type for vote: ${voter}, ${voteId}`);
        return;
      }
      
      console.log(`[VOTING] Processing vote for ${voter}, role: ${voterRole}, vote type: ${voteType}`);
      
      // Verify that this is a valid vote for the player's role
      const isValidVote = (
        (voteType === "mafia" && voterRole?.toLowerCase() === "mafia") ||
        (voteType === "doctor" && voterRole?.toLowerCase() === "doctor") ||
        (voteType === "detective" && voterRole?.toLowerCase() === "detective") ||
        (voteType === "villager") // Everyone can vote during day phase
      );
      
      if (!isValidVote) {
        console.warn(`[VOTING] Invalid vote - ${voter} with role ${voterRole} attempting to cast ${voteType} vote`);
        return;
      }

      // Special handling for all night role votes - record them regardless of session
      if ((voteType === "mafia" || voteType === "doctor" || voteType === "detective") && target !== "s3cr3t_1nv1s1bl3_pl@y3r") {
        console.log(`[VOTING] Directly recording ${voteType} vote for ${target}`);
        
        // Store the vote in the nightVotes tracking
        VotingService.recordNightVote(lobbyId, voteType, target);
        
        // Special handling for detective - send the investigation result immediately
        if (voteType === "detective") {
          // Get the lobby to find player roles
          const lobby = VotingService.getLobby(lobbyId);
          if (lobby) {
            const investigatedPlayer = lobby.players.find(p => p.username === target);
            
            if (investigatedPlayer) {
              const isMafia = investigatedPlayer.role.toLowerCase() === "mafia";
              console.log(`[VOTING] Detective ${voter} investigating ${target}, isMafia: ${isMafia}`);
              
              // Send private message to the detective
              const roleReveal = isMafia ? "is a Mafia member" : "is not a Mafia member";
              const detectiveMsg = {
                sender: "System",
                text: `Your investigation reveals that ${target} ${roleReveal}.`,
                timestamp: new Date(),
                isPrivate: true
              };
              
              socket.emit("message", detectiveMsg);
            }
          }
        }
        
        // Check if all night votes are complete after this vote
        const allNightVotesComplete = VotingService.checkAllNightVotesComplete(lobbyId);
        if (allNightVotesComplete) {
          console.log("[VOTING] All night roles have voted - processing results immediately");
          
          // Process night results immediately when all roles vote
          processNightResults(io, lobbyId);
        }
      }
      
      // For direct votes (with custom voteId), we don't need to cast in session
      let session = null;
      
      // Only try to cast vote in session if it's a standard vote (not direct)
      if (!voteId.includes('_')) {
        // Cast the vote in the session too
        VotingService.castVote(lobbyId, voteId, voter, target);
        
        // Get updated session after vote is cast
        session = VotingService.getSession(lobbyId, voteId);
      }
      
      // Always acknowledge the vote to close the popup
      socket.emit("vote_acknowledged", { 
        voteId: voteId,
        voteType: voteType
      });
      
      // Only process standard session votes if we have a valid session
      if (session && !voteId.includes('_') && Object.keys(session.votes).length === session.voters.size) {
        console.log(`[VOTING] All votes submitted for ${voteType}. Processing vote.`);
        
        // Different processing based on vote type
      if (voteType === "detective") {
        // DETECTIVE VOTES - Make sure vote is recorded
        console.log(`[VOTING] Processing detective vote from ${voter}`);
        
        if (target !== "s3cr3t_1nv1s1bl3_pl@y3r") {
          // Make sure the vote is recorded even here as a backup
          VotingService.recordNightVote(lobbyId, "detective", target);
          console.log(`[VOTING] Detective vote recorded for ${target} in lobby ${lobbyId} (backup method)`);
          
          // Get the lobby to find player roles
          const lobby = VotingService.getLobby(lobbyId);
          if (lobby) {
            const investigatedPlayer = lobby.players.find(p => p.username === target);
            
            if (investigatedPlayer) {
              const isMafia = investigatedPlayer.role.toLowerCase() === "mafia";
              console.log(`[VOTING] Detective ${voter} investigating ${target}, isMafia: ${isMafia}`);
              
              // Send private message to the detective
              const roleReveal = isMafia ? "is a Mafia member" : "is not a Mafia member";
              const detectiveMsg = {
                sender: "System",
                text: `Your investigation reveals that ${target} ${roleReveal}.`,
                timestamp: new Date(),
                isPrivate: true
              };
              
              socket.emit("message", detectiveMsg);
            } else {
              console.log(`[VOTING] Investigation target ${target} not found`);
            }
          }
        }
        
        // Just end the detective vote session (no elimination)
        const sessionIndex = VotingService.getVotingSessionIndex(lobbyId, voteId);
        if (sessionIndex !== -1) {
          console.log(`[VOTING] Ending detective vote session without elimination`);
          VotingService.removeVotingSession(lobbyId, sessionIndex);
        }
      } 
      else if (voteType === "doctor") {
        // DOCTOR VOTES - Store target to save
        console.log(`[VOTING] Doctor ${voter} is saving ${target}`);
        
        if (target !== "s3cr3t_1nv1s1bl3_pl@y3r") {
          // Record the doctor's save vote
          VotingService.recordNightVote(lobbyId, "doctor", target);
        }
        
        // End vote session
        const sessionIndex = VotingService.getVotingSessionIndex(lobbyId, voteId);
        if (sessionIndex !== -1) {
          console.log(`[VOTING] Doctor vote processed and session ended`);
          VotingService.removeVotingSession(lobbyId, sessionIndex);
        }
      }
      else if (voteType === "mafia") {
        // MAFIA VOTES - Store target to kill
        console.log(`[VOTING] Mafia ${voter} is targeting ${target}`);
        
        if (target !== "s3cr3t_1nv1s1bl3_pl@y3r") {
          // Record the mafia's kill vote
          VotingService.recordNightVote(lobbyId, "mafia", target);
        }
        
        // End vote session
        const sessionIndex = VotingService.getVotingSessionIndex(lobbyId, voteId);
        if (sessionIndex !== -1) {
          console.log(`[VOTING] Mafia vote processed and session ended`);
          VotingService.removeVotingSession(lobbyId, sessionIndex);
        }
      }
      else {
        // REGULAR VOTING (day phase) - Process immediately with elimination
        endVotingSession(io, lobbyId, voteId, voteType);
      }
        
        // Check if all night votes have been cast to determine night results
        if (voteType !== "villager") {
          const allNightVotesComplete = VotingService.checkAllNightVotesComplete(lobbyId);
          if (allNightVotesComplete) {
            console.log("[VOTING] All night role votes completed. Processing night results immediately.");
            
            // Get the current night votes
            const nightVotes = VotingService.nightVotes[lobbyId] || { mafia: null, doctor: null, detective: null };
            console.log("[VOTING] Night votes to process:", nightVotes);
            
            // Process doctor save vs mafia kill
            let eliminatedPlayer = null;
            if (nightVotes.mafia && nightVotes.doctor && nightVotes.mafia === nightVotes.doctor) {
              console.log(`[VOTING] Doctor saved ${nightVotes.mafia} from elimination`);
              eliminatedPlayer = null; // Doctor saved the player
            } else if (nightVotes.mafia) {
              eliminatedPlayer = nightVotes.mafia;
              
              // Mark player as eliminated in the lobby
              const lobby = VotingService.getLobby(lobbyId);
              if (lobby) {
                const targetPlayer = lobby.players.find(p => p.username === eliminatedPlayer);
                if (targetPlayer) {
                  targetPlayer.isAlive = false;
                  console.log(`[VOTING] Player ${eliminatedPlayer} was eliminated by Mafia`);
                }
              }
            }
            
            // Broadcast night results to all clients
            io.to(lobbyId).emit("voting_complete", { 
              eliminated: eliminatedPlayer,
              voteType: "night_results"
            });
            
            // Send system message about elimination or no elimination
            let msg;
            if (eliminatedPlayer) {
              msg = `A quiet strike in the dark… a player has been replaced by AI.`;
            } else {
              msg = `An eerie silence lingers… all players remain as they are… for now.`;
            }
            
            io.to(lobbyId).emit("message", {
              sender: "System",
              text: msg,
              timestamp: new Date()
            });
            
            // Reset night votes for next night phase
            VotingService.nightVotes[lobbyId] = { mafia: null, doctor: null, detective: null };
          }
        }
      }
    });

    socket.on("disconnect", () => {
      console.log(`[VOTING SOCKET] ${socket.id} disconnected.`);
    });
  });
}

// Function to reset the processedNightResults flag for a lobby
function resetProcessedNightResults(lobbyId) {
  if (processedNightResults[lobbyId]) {
    console.log(`[VOTING] Resetting processed night results flag for lobby ${lobbyId}`);
    delete processedNightResults[lobbyId];
    return true;
  }
  return false;
}

module.exports = { 
  initVotingSocket,
  resetProcessedNightResults,
  processedNightResults
};