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
  nightPhaseVotes[lobbyId] = {
    mafia: false,
    doctor: false,
    detective: false
  };
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
    const savedPlayer = calculateResults(lobbyId, voteId);
    if (savedPlayer) {
      savedPlayers[lobbyId] = savedPlayer;
      console.log(`[VOTING] Doctor saved ${savedPlayer} in lobby ${lobbyId}`);
    }
    
    // Mark the doctor vote as processed
    nightPhaseVotes[lobbyId].doctor = true;
    
    result = { type: "doctor", saved: savedPlayer };
  } 
  else if (voteType === "detective") {
    // Detective vote - investigate a player
    const investigatedPlayer = calculateResults(lobbyId, voteId);
    if (investigatedPlayer) {
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
        }
      }
    }
    
    // Mark the detective vote as processed
    nightPhaseVotes[lobbyId].detective = true;
    
    result = { type: "detective", investigated: investigatedPlayer };
  }
  else if (voteType === "mafia") {
    // Store mafia vote target
    const targetPlayer = calculateResults(lobbyId, voteId);
    
    // Mark the mafia vote as processed
    nightPhaseVotes[lobbyId].mafia = true;
    
    // If the target exists, store it temporarily
    if (targetPlayer) {
      if (!savedPlayers[lobbyId]) {
        // Only store the target if they're not already saved
        savedPlayers[lobbyId + "_mafia_target"] = targetPlayer;
      }
    }
    
    // We'll calculate the final result at the end of night phase
    result = { type: "mafia", pending: true };
  }

  // Remove the session
  votingSessions[lobbyId].splice(sessionIndex, 1);
  
  // Log the current state of nighttime votes
  if (nightPhaseVotes[lobbyId]) {
    console.log(`[NIGHT VOTES] Current vote status - Mafia: ${nightPhaseVotes[lobbyId].mafia}, Doctor: ${nightPhaseVotes[lobbyId].doctor}, Detective: ${nightPhaseVotes[lobbyId].detective}`);
    console.log(`[NIGHT VOTES] Players needed - Mafia: ${getNumMafiaPlayers(lobbyId)}, Doctor: ${getNumDoctorPlayers(lobbyId)}, Detective: ${getNumDetectivePlayers(lobbyId)}`);
  }

  // Check if all expected night phase votes are in
  // If so, finalize the night phase results
  const mafiaVoted = nightPhaseVotes[lobbyId]?.mafia || getNumMafiaPlayers(lobbyId) === 0;
  const doctorVoted = nightPhaseVotes[lobbyId]?.doctor || getNumDoctorPlayers(lobbyId) === 0; 
  const detectiveVoted = nightPhaseVotes[lobbyId]?.detective || getNumDetectivePlayers(lobbyId) === 0;
  
  if (nightPhaseVotes[lobbyId] && mafiaVoted && doctorVoted && detectiveVoted) {
    console.log(`[NIGHT PHASE] All votes received, finalizing night phase`);
    
    // All night phase votes are in - process the results
    const finalResult = finalizeNightPhase(lobbyId);
    if (finalResult) {
      return finalResult;
    }
  }
  
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

// Process night phase results after all votes are in
function finalizeNightPhase(lobbyId) {
  console.log(`[NIGHT PHASE] Finalizing night phase for lobby ${lobbyId}`);
  
  // Reset night phase tracking
  initializeNightPhaseVotes(lobbyId);
  
  const mafiaTarget = savedPlayers[lobbyId + "_mafia_target"];
  const docTarget = savedPlayers[lobbyId];
  
  console.log(`[NIGHT PHASE] Mafia target: ${mafiaTarget || "none"}, Doctor saved: ${docTarget || "none"}`);
  
  // Remove temporary storage
  delete savedPlayers[lobbyId + "_mafia_target"];
  
  // Check if mafia targeted someone and if they were saved
  if (mafiaTarget) {
    if (mafiaTarget === docTarget) {
      // Target was saved by doctor
      console.log(`[VOTING] ${mafiaTarget} was targeted by Mafia but saved by Doctor in lobby ${lobbyId}`);
      delete savedPlayers[lobbyId]; // Clear saved player
      return { type: "mafia", eliminated: null, saved: mafiaTarget };
    } else {
      // Target was not saved, mark them as eliminated
      eliminatedPlayers[lobbyId].add(mafiaTarget);

      // Mark them as not alive in the lobby
      const lobby = lobbyService.getLobby(lobbyId);
      if (lobby) {
        const p = lobby.players.find((pl) => pl.username === mafiaTarget);
        if (p) {
          p.isAlive = false;
        }
      }
      
      delete savedPlayers[lobbyId]; // Clear saved player
      return { type: "mafia", eliminated: mafiaTarget, saved: null };
    }
  } else {
    // No mafia target
    delete savedPlayers[lobbyId]; // Clear saved player
    return { type: "mafia", eliminated: null, saved: null };
  }
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
};
