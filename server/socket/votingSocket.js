const { VOTING_DURATION, NIGHT_DURATION } = require("../constants");
const VotingService = require("../services/votingService");


const endedVotes = {};
const processedNightResults = {};

// Process night results when all roles have voted
function processNightResults(io, lobbyId) {
  // Prevent duplicate processing
  if (processedNightResults[lobbyId]) return;
  processedNightResults[lobbyId] = true;
  
  // Get night votes and determine outcome
  const nightVotes = VotingService.nightVotes[lobbyId] || { mafia: null, doctor: null, detective: null };
  let eliminatedPlayer = null;
  
  // Check if doctor saved mafia target
  if (nightVotes.mafia && nightVotes.doctor && nightVotes.mafia === nightVotes.doctor) {
    console.log(`[VOTING] Doctor saved ${nightVotes.mafia}`);
  } else if (nightVotes.mafia) {
    eliminatedPlayer = nightVotes.mafia;
    
    // Mark player as eliminated
    const lobby = VotingService.getLobby(lobbyId);
    if (lobby) {
      const targetPlayer = lobby.players.find(p => p.username === eliminatedPlayer);
      if (targetPlayer) {
        targetPlayer.isAlive = false;
      }
    }
  }
  
  // Broadcast results to clients
  io.to(lobbyId).emit("voting_complete", { 
    eliminated: eliminatedPlayer,
    voteType: "night_results"
  });
  
  // Send thematic message about the night's events
  const msg = eliminatedPlayer 
    ? `A quiet strike in the dark… a player has been replaced by AI.`
    : `An eerie silence lingers… all players remain as they are… for now.`;
  
  io.to(lobbyId).emit("message", {
    sender: "System",
    text: msg,
    timestamp: new Date()
  });
  
  // Clean up
  VotingService.clearVotingSessions(lobbyId);
  
  // Reset for next night
  setTimeout(() => {
    VotingService.nightVotes[lobbyId] = { mafia: null, doctor: null, detective: null };
    delete processedNightResults[lobbyId];
  }, 1000);
}

function endVotingSession(io, lobbyId, voteId, voteType) {
  // Prevent duplicate session endings
  if (endedVotes[voteId]) return;
  endedVotes[voteId] = true;

  // Get the session and verify it exists
  const session = VotingService.getSession(lobbyId, voteId);
  if (!session) {
    console.log(`[VOTING] Session ${voteId} not found when ending`);
    return;
  }

  console.log(`[VOTING] Ending ${voteType} session with ${Object.keys(session.votes).length} votes`);
  
  // End the voting session and get the result
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
      
      return;
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
      } else {
        // Start a new voting session
        voteId = VotingService.startVoting(lobbyId, voteType);
        if (!voteId) {
          console.warn(`[VOTING] Failed to start voting for lobby ${lobbyId}`);
          return;
        }
        session = VotingService.getSession(lobbyId, voteId);
        if (!session) {
          console.warn(
            `[VOTING] Could not retrieve session for voteId ${voteId} in lobby ${lobbyId}`
          );
          return;
        }
        endedVotes[voteId] = false;
        // Set a timer to auto-end the voting session after VOTING_DURATION seconds
        setTimeout(() => {
          const currentSession = VotingService.getSession(lobbyId, voteId);
          if (currentSession) {
            console.log("[TIMEOUT] Time limit reached. Ending voting session.");
            endVotingSession(io, lobbyId, voteId, voteType);
          }
        }, VOTING_DURATION * 1000);
      }
      // Send the voting interface event only to the requesting client
      socket.emit("open_voting", {
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

    // Process a vote submission
    socket.on("submit_vote", ({ lobbyId, voteId, voter, target, voterRole, voteType: clientVoteType }) => {
      socket.join(lobbyId);
      if (!lobbyId || !voteId || !voter || !target) {
        console.warn("[VOTING] Incomplete vote submission.");
        return;
      }
      
      // Store username in socket for detective messages
      if (voter && !socket.username) {
        socket.username = voter;
      }

      // Special handling for villager votes 
      if (voteId.startsWith('villager_') || clientVoteType === 'villager') {
        const allSessions = VotingService.getVotingSessions(lobbyId);
        const villagerSession = allSessions && allSessions.find(s => s.voteType === 'villager');
        
        if (villagerSession) {
          // Directly record vote in session
          villagerSession.votes[voter] = target;
          console.log(`[VOTING] Day vote: ${voter} → ${target}`);
          
          // Send acknowledgment
          socket.emit("vote_acknowledged", { 
            voteId: voteId,
            voteType: 'villager'
          });
          
          // Process results if all votes are in
          const allVoters = villagerSession.voters.size;
          const votesCast = Object.keys(villagerSession.votes).length;
          
          if (votesCast === allVoters) {
            console.log(`[VOTING] All day votes received (${votesCast}/${allVoters}). Processing.`);
            endVotingSession(io, lobbyId, villagerSession.voteId, 'villager');
          }
          
          return;
        } else {
          console.log(`[VOTING] No villager session found for lobby ${lobbyId}`);
        }
      }
      
      // Regular processing for non-villager votes
      let sessionBeforeVote = null;
      const allSessions = VotingService.getVotingSessions(lobbyId);
      
      if (allSessions && allSessions.length > 0) {
        sessionBeforeVote = VotingService.getSession(lobbyId, voteId);
      }
      
      // Determine vote type from available information
      let voteType = clientVoteType;
      
      if (!voteType && sessionBeforeVote) {
        voteType = sessionBeforeVote.voteType;
      }
      
      if (!voteType) {
        if (voteId.startsWith('mafia_')) voteType = 'mafia';
        else if (voteId.startsWith('doctor_')) voteType = 'doctor';
        else if (voteId.startsWith('detective_')) voteType = 'detective';
        else if (voterRole) voteType = voterRole.toLowerCase();
      }
      
      if (!voteType) {
        console.warn(`[VOTING] Could not determine vote type for vote: ${voter}, ${voteId}`);
        return;
      }
      
      console.log(`[VOTING] ${voteType} vote: ${voter} → ${target}`);
      
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

      // Handle night role votes (mafia, doctor, detective)
      if ((voteType === "mafia" || voteType === "doctor" || voteType === "detective") && target !== "s3cr3t_1nv1s1bl3_pl@y3r") {
        // Record vote in the tracking system
        VotingService.recordNightVote(lobbyId, voteType, target);
        
        // Special handling for detective - send investigation result
        if (voteType === "detective") {
          const lobby = VotingService.getLobby(lobbyId);
          if (lobby) {
            const investigatedPlayer = lobby.players.find(p => p.username === target);
            if (investigatedPlayer) {
              const isMafia = investigatedPlayer.role.toLowerCase() === "mafia";
              const roleReveal = isMafia ? "is a Mafia member" : "is not a Mafia member";
              
              socket.emit("message", {
                sender: "System",
                text: `Your investigation reveals that ${target} ${roleReveal}.`,
                timestamp: new Date(),
                isPrivate: true
              });
            }
          }
        }
        
        // Check if all night roles have voted and process results if so
        if (VotingService.checkAllNightVotesComplete(lobbyId)) {
          console.log("[VOTING] All night roles voted - processing results");
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
      // Find the correct voteId to acknowledge
      let acknowledgeVoteId = voteId;
      
      if (voteType === "villager" && voteId.startsWith("villager_")) {
        // For villager votes with custom IDs, send back the same custom ID
        // This ensures the frontend can match the acknowledgment to its request
        console.log(`[VOTING] Acknowledging villager vote with original voteId: ${voteId}`);
      }
      
      socket.emit("vote_acknowledged", { 
        voteId: acknowledgeVoteId,
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
      else if (voteType === "villager") {
        // Fix for day phase voting - collect votes directly
        if (target !== "s3cr3t_1nv1s1bl3_pl@y3r") {
          console.log(`[VOTING] Day phase vote from ${voter} for ${target}`);
          
          // For villager votes, find any active villager voting session
          const allSessions = VotingService.getVotingSessions(lobbyId);
          const villagerSession = allSessions && allSessions.find(s => s.voteType === 'villager');
          
          if (villagerSession) {
            console.log(`[VOTING] Found villager session with ID: ${villagerSession.voteId}`);
            
            // Use the actual session voteId, not the client-provided one
            const actualVoteId = villagerSession.voteId;
            
            // DIRECTLY add the vote to the session's votes object to bypass validation
            // This is a workaround for potential validation issues
            villagerSession.votes[voter] = target;
            console.log(`[VOTING] DIRECTLY added vote from ${voter} for ${target} to session ${actualVoteId}`);
            console.log(`[VOTING] Session votes after direct modification:`, villagerSession.votes);
            
            // Get updated session after vote cast
            session = villagerSession;
            
            // Only end the session if all expected votes have been cast
            const allVoters = session ? session.voters.size : 0;
            const votesCast = session ? Object.keys(session.votes).length : 0;
            
            console.log(`[VOTING] Day phase vote status - ${votesCast} votes cast out of ${allVoters} voters`);
            
            // End voting session if all votes are in
            if (session && votesCast === allVoters) {
              console.log(`[VOTING] All day phase votes received. Processing results.`);
              // Force a final check of votes before ending
              console.log(`[VOTING] Final votes before processing:`, session.votes);
              endVotingSession(io, lobbyId, actualVoteId, voteType);
            }
          } else {
            console.warn(`[VOTING] No active villager voting session found for lobby ${lobbyId}`);
          }
        }
      }
      else {
        // Handle any other vote types
        console.log(`[VOTING] Processing unknown vote type: ${voteType}`);
        endVotingSession(io, lobbyId, voteId, voteType);
      }
    } // <-- Added missing closing brace here for the if statement that started on line 371
      
    // We'll only check for night votes completion if we haven't already processed
    // the results through processNightResults function
    if (voteType !== "villager" && !processedNightResults[lobbyId]) {
      const allNightVotesComplete = VotingService.checkAllNightVotesComplete(lobbyId);
      if (allNightVotesComplete) {
        console.log("[VOTING] All night role votes completed. Processing night results.");
        // Call the processNightResults function which handles all the night results logic
        processNightResults(io, lobbyId);
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