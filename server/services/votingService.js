// server/services/votingService.js

const VotingSession = require("../models/votingModel");
const lobbyService = require("./lobbyService");
const { v4: uuidv4 } = require("uuid");

const votingSessions = {};        // { [lobbyId]: VotingSession[] }
const eliminatedPlayers = {};     // { [lobbyId]: Set of usernames }

/**
 * startVoting:
 * Creates a new VotingSession, populates newSession.players,
 * logs debug info if a player is excluded, returns a voteId.
 */
// Initialize or reset night phase votes tracking
function initializeNightPhaseVotes(lobbyId) {
  console.log(`[INIT NIGHT VOTES] Initializing night phase votes for lobby ${lobbyId}`);
  
  // Clear any existing saved players for this lobby
  delete savedPlayers[lobbyId];
  delete savedPlayers[lobbyId + "_mafia_target"];
  
  // Initialize vote tracking
  nightPhaseVotes[lobbyId] = {
    mafia: false,
    doctor: false,
    detective: false
  };
  
  console.log(`[INIT NIGHT VOTES] Night phase votes initialized:`, nightPhaseVotes[lobbyId]);
}

function startVoting(lobbyId, voteType) {
  if (!votingSessions[lobbyId]) {
    votingSessions[lobbyId] = [];
  }
  if (!eliminatedPlayers[lobbyId]) {
    eliminatedPlayers[lobbyId] = new Set();
  }
  
  // Initialize night phase votes tracking if not already initialized
  if (!nightPhaseVotes[lobbyId]) {
    initializeNightPhaseVotes(lobbyId);
  }

  const voteId = uuidv4();
  const newSession = new VotingSession(lobbyId, voteId, voteType);

  const lobby = lobbyService.getLobby(lobbyId);
  if (!lobby) {
    console.warn(`[VOTING] Attempted to start voting for non-existent lobby ${lobbyId}.`);
    return null;
  }

  // Helpful debug: show who is in the lobby right before we build the session
  console.log("[DEBUG] Lobby players at voting start:", lobby.players.map(p => ({
    username: p.username,
    isAlive: p.isAlive,
    role: p.role
  })));

  // Populate candidates: all alive players except eliminated ones
  lobby.players.forEach(player => {
    if (player.isAlive && !eliminatedPlayers[lobbyId].has(player.username)) {
      newSession.players.add(player.username);
    }
  });

  // Handle different vote types
  if (voteType === "mafia") {
    // Populate voters: only mafia members should vote
    lobby.players.forEach(player => {
      if (player.isAlive &&
          !eliminatedPlayers[lobbyId].has(player.username) &&
          player.role && player.role.toLowerCase() === "mafia") {
        newSession.voters.add(player.username);
      }
    });
  } else if (voteType === "doctor") {
    // Populate voters: only doctors should vote
    lobby.players.forEach(player => {
      if (player.isAlive &&
          !eliminatedPlayers[lobbyId].has(player.username) &&
          player.role && player.role.toLowerCase() === "doctor") {
        newSession.voters.add(player.username);
      }
    });
  } else if (voteType === "detective") {
    // Populate voters: only detectives should vote
    lobby.players.forEach(player => {
      if (player.isAlive &&
          !eliminatedPlayers[lobbyId].has(player.username) &&
          player.role && player.role.toLowerCase() === "detective") {
        newSession.voters.add(player.username);
      }
    });
  } else {
    // Default case (villager voting): all alive players vote
    lobby.players.forEach(player => {
      if (player.isAlive && !eliminatedPlayers[lobbyId].has(player.username)) {
        newSession.voters.add(player.username);
      }
    });
  }
  
  votingSessions[lobbyId].push(newSession);

  console.log(
    `[VOTING] New voting session started in lobby ${lobbyId} (Type: ${voteType}). \n\tPlayers to vote:`,
    `${Array.from(newSession.players)}\n\tVoters: ${Array.from(newSession.voters)}`
  );

  return voteId;
}

function castVote(lobbyId, voteId, voter, target) {
  const session = votingSessions[lobbyId]?.find((s) => s.voteId === voteId);
  if (!session) {
    console.warn(`[VOTING] No session ${voteId} in lobby ${lobbyId}.`);
    return;
  }

  // Duplicate vote check
  if (session.votes.hasOwnProperty(voter)) {
    console.warn(`[VOTING] Duplicate vote from ${voter} in session ${voteId} (Lobby ${lobbyId}).`);
    return;
  }

  // Validate voter & target
  // Special checks for each vote type
  if (target !== "s3cr3t_1nv1s1bl3_pl@y3r" && !session.players.has(target)) {
    console.log(`[DEBUG] Invalid target: ${target} not in player list`);
    console.warn(`[VOTING] Invalid vote: ${voter} -> ${target} not recognized in session ${voteId}.`);
    return;
  }
  
  // Check if voter is allowed to vote in this session
  if (!session.voters.has(voter)) {
    console.log(`[DEBUG] Invalid voter: ${voter} not in voters list for ${session.voteType} vote`);
    console.warn(`[VOTING] Invalid vote: ${voter} is not allowed to vote in this ${session.voteType} session.`);
    return;
  }

  session.votes[voter] = target;
  console.log(`[VOTING] ${voter} voted for ${target} in session ${voteId} (Lobby ${lobbyId}).`);
}

function calculateResults(lobbyId, voteId) {
  const session = votingSessions[lobbyId]?.find((s) => s.voteId === voteId);
  if (!session) return null;

  const voteType = session.voteType;
  
  // Special handling for doctor and detective votes - just get the selected player
  if (voteType === "doctor" || voteType === "detective") {
    // Get all votes cast by eligible voters
    const voterVotes = [];
    for (const voter of session.voters) {
      if (session.votes[voter]) {
        voterVotes.push(session.votes[voter]);
      }
    }

    // If there are any votes
    if (voterVotes.length > 0) {
      // Just take the first valid vote that's not the abstain token
      const target = voterVotes.find(vote => vote !== "s3cr3t_1nv1s1bl3_pl@y3r");
      if (target) {
        console.log(`[VOTING] ${voteType} selected ${target} in session ${voteId} (lobby ${lobbyId})`);
        return target;
      }
    }
    return null;
  }
  
  // Standard voting logic for mafia and villager votes
  const voteCounts = {};
  for (const target of Object.values(session.votes)) {
    voteCounts[target] = (voteCounts[target] || 0) + 1;
  }

  let maxVotes = 0;
  let candidate = null;
  let tie = false;

  // Determine which candidate received the highest number of votes
  for (const [target, count] of Object.entries(voteCounts)) {
    console.log("[VOTING SERVICE]", target, count)
    if (target === "s3cr3t_1nv1s1bl3_pl@y3r") continue;
    if (count > maxVotes) {
      maxVotes = count;
      candidate = target;
      tie = false;
    } else if (count === maxVotes) {
      tie = true;
    }
  }

  // If there is a tie or the winner is the secret token, no one is eliminated.
  if (tie || candidate === "s3cr3t_1nv1s1bl3_pl@y3r" || maxVotes === 0) {
    console.log(
      `[VOTING] session ${voteId} in lobby ${lobbyId} ended with a tie or abstention.`
    );
    return null;
  }

  console.log(`[VOTING] session ${voteId} in lobby ${lobbyId} ended. Target: ${candidate}`);
  return candidate;
}

// Track saved and investigated players, and night phase status
const savedPlayers = {};     // { [lobbyId]: username }
const investigatedPlayers = {};  // { [lobbyId]: { username: role } }
const nightPhaseVotes = {};  // { [lobbyId]: { mafia: boolean, doctor: boolean, detective: boolean } }

function endVoting(lobbyId, voteId) {
  const sessionIndex = votingSessions[lobbyId]?.findIndex((s) => s.voteId === voteId);
  if (sessionIndex === -1 || sessionIndex === undefined) return null;
  
  const session = votingSessions[lobbyId][sessionIndex];
  const voteType = session.voteType;
  let result = null;

  // Handle the day/villager voting immediately as before
  if (voteType === "villager") {
    // Regular villager vote (daytime)
    const eliminatedPlayer = calculateResults(lobbyId, voteId);
    
    if (eliminatedPlayer) {
      eliminatedPlayers[lobbyId].add(eliminatedPlayer);

      // Mark them as not alive in the lobby
      const lobby = lobbyService.getLobby(lobbyId);
      if (lobby) {
        const p = lobby.players.find((pl) => pl.username === eliminatedPlayer);
        if (p) {
          p.isAlive = false;
        }
      }
    }
    
    result = { type: "villager", eliminated: eliminatedPlayer };
    
    // Remove session
    votingSessions[lobbyId].splice(sessionIndex, 1);
    return result;
  }
  
  // Handle the night phase votes
  // First, record the vote results without applying them
  if (voteType === "doctor") {
    // Doctor vote - save the selected player
    // Get the doctor's vote directly
    const doctorVoters = Array.from(session.voters);
    console.log(`[DOCTOR VOTE] Doctor voters:`, doctorVoters);
    
    // Check if we have all the votes we expect
    if (session.votes) {
      console.log(`[DOCTOR VOTE] Current votes in session:`, JSON.stringify(session.votes, null, 2));
    } else {
      console.warn(`[DOCTOR VOTE] No votes object in session!`);
    }
    
    // Get the target directly from the votes
    let savedPlayer = null;
    if (doctorVoters.length > 0 && session.votes[doctorVoters[0]]) {
      savedPlayer = session.votes[doctorVoters[0]];
      console.log(`[DOCTOR VOTE] Doctor ${doctorVoters[0]} voted to save: ${savedPlayer}`);
    } else {
      console.warn(`[DOCTOR VOTE] No valid doctor vote found!`);
    }
    
    if (savedPlayer && savedPlayer !== "s3cr3t_1nv1s1bl3_pl@y3r") {
      savedPlayers[lobbyId] = savedPlayer;
      console.log(`[VOTING] Doctor saved ${savedPlayer} in lobby ${lobbyId}`);
    } else {
      console.log(`[VOTING] No valid doctor save in lobby ${lobbyId}`);
    }
    
    // Mark the doctor vote as processed
    nightPhaseVotes[lobbyId].doctor = true;
    
    result = { type: "doctor", saved: savedPlayer };
  } 
  else if (voteType === "detective") {
    // Detective vote - investigate a player
    // Get the detective's vote directly
    const detectiveVoters = Array.from(session.voters);
    console.log(`[DETECTIVE VOTE] Detective voters:`, detectiveVoters);
    
    // Check if we have all the votes we expect
    if (session.votes) {
      console.log(`[DETECTIVE VOTE] Current votes in session:`, JSON.stringify(session.votes, null, 2));
    } else {
      console.warn(`[DETECTIVE VOTE] No votes object in session!`);
    }
    
    // Get the target directly from the votes
    let investigatedPlayer = null;
    if (detectiveVoters.length > 0 && session.votes[detectiveVoters[0]]) {
      investigatedPlayer = session.votes[detectiveVoters[0]];
      console.log(`[DETECTIVE VOTE] Detective ${detectiveVoters[0]} voted to investigate: ${investigatedPlayer}`);
    } else {
      console.warn(`[DETECTIVE VOTE] No valid detective vote found!`);
    }
    
    if (investigatedPlayer && investigatedPlayer !== "s3cr3t_1nv1s1bl3_pl@y3r") {
      // Find the player's role
      const lobby = lobbyService.getLobby(lobbyId);
      if (lobby) {
        const player = lobby.players.find(p => p.username === investigatedPlayer);
        if (player) {
          // Store the investigation result
          if (!investigatedPlayers[lobbyId]) {
            investigatedPlayers[lobbyId] = {};
          }
          investigatedPlayers[lobbyId][investigatedPlayer] = player.role;
          console.log(`[VOTING] Detective investigated ${investigatedPlayer} (${player.role}) in lobby ${lobbyId}`);
        } else {
          console.warn(`[VOTING] Could not find player ${investigatedPlayer} in lobby ${lobbyId} for detective investigation`);
        }
      } else {
        console.warn(`[VOTING] Could not find lobby ${lobbyId} for detective investigation`);
      }
    } else {
      console.log(`[VOTING] No valid detective investigation in lobby ${lobbyId}`);
    }
    
    // Mark the detective vote as processed
    nightPhaseVotes[lobbyId].detective = true;
    
    result = { type: "detective", investigated: investigatedPlayer };
  }
  else if (voteType === "mafia") {
    // Get the mafia's vote directly - do not use calculateResults as it might eliminate players
    const mafiaVoters = Array.from(session.voters);
    console.log(`[MAFIA VOTE] Mafia voters (${mafiaVoters.length}):`, mafiaVoters);
    
    // Check if we have all the votes we expect
    if (session.votes) {
      console.log(`[MAFIA VOTE] Current votes in session:`, JSON.stringify(session.votes, null, 2));
    } else {
      console.warn(`[MAFIA VOTE] No votes object in session!`);
    }
    
    // Get the target directly from the votes - IMPORTANT: don't eliminate yet
    let targetPlayer = null;
    if (mafiaVoters.length > 0) {
      // Count the votes to determine the target
      const voteCounts = {};
      mafiaVoters.forEach(voter => {
        if (session.votes[voter] && session.votes[voter] !== "s3cr3t_1nv1s1bl3_pl@y3r") {
          voteCounts[session.votes[voter]] = (voteCounts[session.votes[voter]] || 0) + 1;
        }
      });
      
      // Find the player with the most votes
      let maxVotes = 0;
      let tie = false;
      
      Object.entries(voteCounts).forEach(([player, count]) => {
        console.log(`[MAFIA VOTE] Player ${player} received ${count} votes`);
        if (count > maxVotes) {
          maxVotes = count;
          targetPlayer = player;
          tie = false;
        } else if (count === maxVotes) {
          tie = true;
        }
      });
      
      if (tie) {
        console.log(`[MAFIA VOTE] Tie vote - no target selected`);
        targetPlayer = null;
      } else {
        console.log(`[MAFIA VOTE] Mafia selected target: ${targetPlayer}`);
      }
    }
    
    // Mark the mafia vote as processed
    nightPhaseVotes[lobbyId].mafia = true;
    
    // IMPORTANT: Store target but DO NOT eliminate yet - must wait for doctor
    if (targetPlayer) {
      // Store the target - will be eliminated at the end of night phase
      // only if not saved by doctor
      savedPlayers[lobbyId + "_mafia_target"] = targetPlayer;
      console.log(`[MAFIA VOTE] Stored mafia target ${targetPlayer} for end of night phase`);
    }
    
    // We'll calculate the final result at the end of night phase
    result = { type: "mafia", pending: true, target: targetPlayer };
  }

  // For night phase votes, don't process until the end of the night phase
  if (voteType === "mafia" || voteType === "doctor" || voteType === "detective") {
    // Just mark the vote as recorded and remove the session, but don't finalize results yet
    // The vote results will be processed at the end of the night phase
    console.log(`[NIGHT PHASE] ${voteType} vote recorded. Waiting for all roles to vote.`);
    
    // Remove the session
    votingSessions[lobbyId].splice(sessionIndex, 1);
    
    // Log the current state of nighttime votes
    if (nightPhaseVotes[lobbyId]) {
      console.log(`[NIGHT VOTES] Current vote status - Mafia: ${nightPhaseVotes[lobbyId].mafia}, Doctor: ${nightPhaseVotes[lobbyId].doctor}, Detective: ${nightPhaseVotes[lobbyId].detective}`);
      console.log(`[NIGHT VOTES] Players needed - Mafia: ${getNumMafiaPlayers(lobbyId)}, Doctor: ${getNumDoctorPlayers(lobbyId)}, Detective: ${getNumDetectivePlayers(lobbyId)}`);
    }
    
    return result;
  }
  
  // For villager votes, process immediately
  // Remove the session
  votingSessions[lobbyId].splice(sessionIndex, 1);
  
  return result;
}

// Helper function to count mafia players
function getNumMafiaPlayers(lobbyId) {
  const lobby = lobbyService.getLobby(lobbyId);
  if (!lobby) return 0;
  
  return lobby.players.filter(p => p.isAlive && p.role && p.role.toLowerCase() === "mafia").length;
}

// Helper function to count doctor players
function getNumDoctorPlayers(lobbyId) {
  const lobby = lobbyService.getLobby(lobbyId);
  if (!lobby) return 0;
  
  return lobby.players.filter(p => p.isAlive && p.role && p.role.toLowerCase() === "doctor").length;
}

// Helper function to count detective players
function getNumDetectivePlayers(lobbyId) {
  const lobby = lobbyService.getLobby(lobbyId);
  if (!lobby) return 0;
  
  return lobby.players.filter(p => p.isAlive && p.role && p.role.toLowerCase() === "detective").length;
}

// Flag to track whether finalizeNightPhase has already run for a lobby
const finalizedLobbies = new Set();

// Process night phase results after all votes are in
function finalizeNightPhase(lobbyId) {
  // Check if we've already finalized this lobby in this night phase
  if (finalizedLobbies.has(lobbyId)) {
    console.log(`[FINALIZE] Already finalized lobby ${lobbyId} this night phase - returning cached result`);
    // Return a default result to avoid errors
    return {
      type: "mafia",
      eliminated: null,
      saved: null,
      investigated: null,
      alreadyFinalized: true
    };
  }
  
  // Mark this lobby as finalized
  finalizedLobbies.add(lobbyId);
  console.log(`[FINALIZE] First time finalizing lobby ${lobbyId} this night phase`);
  console.log(`[NIGHT PHASE] Finalizing night phase for lobby ${lobbyId}`);
  
  // CRITICAL: Get all night phase state BEFORE reset
  const lobby = lobbyService.getLobby(lobbyId);
  const mafiaTarget = savedPlayers[lobbyId + "_mafia_target"];
  const docTarget = savedPlayers[lobbyId];
  const detectiveResults = {...(investigatedPlayers[lobbyId] || {})};
  const hasDetectiveResults = Object.keys(detectiveResults).length > 0;
  
  console.log(`[NIGHT PHASE] SUMMARY for lobby ${lobbyId}:`);
  console.log(`  - Mafia target: ${mafiaTarget || "none"}`);
  console.log(`  - Doctor saved: ${docTarget || "none"}`);
  console.log(`  - Detective investigated: ${hasDetectiveResults ? Object.keys(detectiveResults).join(', ') : "none"}`);
  
  // Store results in a structured way for return
  const result = {
    type: "mafia",          // Main result type is mafia for backward compatibility
    eliminated: null,       // Who is eliminated (if anyone)
    saved: null,            // Who was saved by doctor (if anyone) 
    investigated: null,     // Who was investigated by detective (if anyone)
    doctorAction: docTarget ? { type: "doctor", saved: docTarget } : null,
    detectiveAction: hasDetectiveResults ? 
      { type: "detective", investigated: Object.keys(detectiveResults)[0] } : null
  };
  
  console.log(`[NIGHT PHASE] Initial result object:`, JSON.stringify(result, null, 2));
  
  // Now process the actions in sequence - doctor saves take priority
  // 1. Doctor save logic - simply record the save action
  if (docTarget) {
    result.saved = docTarget;
    console.log(`[DOCTOR] Doctor saved ${docTarget} in lobby ${lobbyId}`);
  }
  
  // 2. Detective investigation - simply record the investigation
  if (hasDetectiveResults) {
    result.investigated = Object.keys(detectiveResults)[0];
    console.log(`[DETECTIVE] Detective investigated ${result.investigated} in lobby ${lobbyId}`);
  }
  
  // 3. Mafia kill - check against doctor save
  if (mafiaTarget) {
    if (mafiaTarget === docTarget) {
      // Target was saved by doctor - no elimination
      console.log(`[MAFIA/DOCTOR] ${mafiaTarget} was targeted by Mafia but SAVED by Doctor in lobby ${lobbyId}`);
      result.eliminated = null;
      result.saved = mafiaTarget;
    } else {
      // Target was NOT saved, mark them as eliminated
      console.log(`[MAFIA] ${mafiaTarget} was targeted by Mafia and NOT saved - marking as eliminated`);
      
      result.eliminated = mafiaTarget;
      
      // Only now do we actually change the player's status to eliminated
      if (lobby) {
        const targetPlayer = lobby.players.find(p => p.username === mafiaTarget);
        if (targetPlayer) {
          console.log(`[PLAYER ELIMINATED] Marking ${mafiaTarget} as not alive`);
          targetPlayer.isAlive = false;
          eliminatedPlayers[lobbyId].add(mafiaTarget);
        } else {
          console.warn(`[ERROR] Could not find player ${mafiaTarget} to eliminate`);
        }
      }
    }
  } else {
    console.log(`[MAFIA] No valid mafia target in lobby ${lobbyId}`);
  }
  
  // Now ensure NO INVESTIGATION TARGETS are eliminated incorrectly (backup safety check)
  if (hasDetectiveResults && lobby) {
    Object.keys(detectiveResults).forEach(investigatedName => {
      const investigatedPlayer = lobby.players.find(p => p.username === investigatedName);
      if (investigatedPlayer && !investigatedPlayer.isAlive && investigatedName !== result.eliminated) {
        console.warn(`[SAFETY CHECK] Investigated player ${investigatedName} was incorrectly eliminated - restoring`);
        investigatedPlayer.isAlive = true;
        eliminatedPlayers[lobbyId].delete(investigatedName);
      }
    });
  }
  
  // Now ensure SAVED PLAYERS are not eliminated incorrectly (backup safety check) 
  if (docTarget && lobby) {
    const savedPlayer = lobby.players.find(p => p.username === docTarget);
    if (savedPlayer && !savedPlayer.isAlive) {
      console.warn(`[SAFETY CHECK] Saved player ${docTarget} was incorrectly eliminated - restoring`);
      savedPlayer.isAlive = true;
      eliminatedPlayers[lobbyId].delete(docTarget);
    }
  }
  
  // Clear all stored voting data after processing
  initializeNightPhaseVotes(lobbyId);
  
  // Clear the finalized flag for this lobby so it can be processed again next night
  finalizedLobbies.delete(lobbyId);
  
  delete savedPlayers[lobbyId + "_mafia_target"];
  delete savedPlayers[lobbyId];
  
  console.log(`[NIGHT PHASE] Final result for ${lobbyId}:`, result);
  
  return result;
}

function getVotingSessions(lobbyId) {
  return votingSessions[lobbyId] || [];
}

function getSession(lobbyId, voteId) {
  return votingSessions[lobbyId]?.find((s) => s.voteId === voteId) || null;
}

function getInvestigationResults(lobbyId, username) {
  if (!investigatedPlayers[lobbyId]) return null;
  
  // For detectives, return all investigation results
  return investigatedPlayers[lobbyId];
}

function getLobby(lobbyId) {
  return lobbyService.getLobby(lobbyId);
}

module.exports = {
  startVoting,
  castVote,
  endVoting,
  getVotingSessions,
  getSession,
  getInvestigationResults,
  getLobby,
  initializeNightPhaseVotes,
  finalizeNightPhase,  // Export the finalizeNightPhase function
};
