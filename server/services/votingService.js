// server/services/votingService.js

const VotingSession = require("../models/votingModel");
const lobbyService = require("./lobbyService");
const { v4: uuidv4 } = require("uuid");

const votingSessions = {};        // { [lobbyId]: VotingSession[] }
const eliminatedPlayers = {};     // { [lobbyId]: Set of usernames }
const doctorSavedPlayers = {};    // { [lobbyId]: Username of the saved player }
const nightVotes = {};            // { [lobbyId]: { mafia: String, doctor: String, detective: String } }
const detectiveResults = {};      // { [lobbyId]: String } - Stores the player investigated by detective

/**
 * startVoting:
 * Creates a new VotingSession, populates newSession.players,
 * logs debug info if a player is excluded, returns a voteId.
 */
function startVoting(lobbyId, voteType) {
  if (!votingSessions[lobbyId]) {
    votingSessions[lobbyId] = [];
  }
  if (!eliminatedPlayers[lobbyId]) {
    eliminatedPlayers[lobbyId] = new Set();
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

  if (voteType === "mafia") {
    // Populate candidates: maybe every player except eliminated ones
    lobby.players.forEach(player => {
      if (player.isAlive && !eliminatedPlayers[lobbyId].has(player.username)) {
        newSession.players.add(player.username);
      }
    });

    // Populate voters: only mafia members should vote
    lobby.players.forEach(player => {
      if (player.isAlive &&
          !eliminatedPlayers[lobbyId].has(player.username) &&
          player.role && player.role.toLowerCase() === "mafia") {
        newSession.voters.add(player.username);
      }
    });
  } else if (voteType === "doctor") {
    // Populate candidates: every alive player
    lobby.players.forEach(player => {
      if (player.isAlive && !eliminatedPlayers[lobbyId].has(player.username)) {
        newSession.players.add(player.username);
      }
    });

    // Populate voters: only doctor should vote
    lobby.players.forEach(player => {
      if (player.isAlive &&
          !eliminatedPlayers[lobbyId].has(player.username) &&
          player.role && player.role.toLowerCase() === "doctor") {
        newSession.voters.add(player.username);
      }
    });
  } else if (voteType === "detective") {
    // Populate candidates: every alive player
    lobby.players.forEach(player => {
      if (player.isAlive && !eliminatedPlayers[lobbyId].has(player.username)) {
        newSession.players.add(player.username);
      }
    });

    // Populate voters: only detective should vote
    lobby.players.forEach(player => {
      if (player.isAlive &&
          !eliminatedPlayers[lobbyId].has(player.username) &&
          player.role && player.role.toLowerCase() === "detective") {
        newSession.voters.add(player.username);
      }
    });
  } else {
    // villager voting (day phase)
    lobby.players.forEach(player => {
      if (player.isAlive && !eliminatedPlayers[lobbyId].has(player.username)) {
        newSession.players.add(player.username);
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
  // Log all vote details at the beginning
  console.log(`[VOTING SERVICE] castVote called for: {lobbyId: ${lobbyId}, voteId: ${voteId}, voter: ${voter}, target: ${target}}`);

  // Get the session
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

  // Log the session state before validating
  console.log(`[VOTING SERVICE] Session before validating: {voteType: ${session.voteType}, voters: ${Array.from(session.voters)}, players: ${Array.from(session.players)}}`);

  // For villager votes, make sure voter is in voters list
  if (session.voteType === "villager" && !session.voters.has(voter)) {
    console.log(`[VOTING] Adding ${voter} to voters list for villager voting`);
    session.voters.add(voter);
  }

  // Validate voter & target with less strict conditions for villager votes and special role votes
  let validVote = true;
  
  // Skip validation completely for the secret token target
  if (target !== "s3cr3t_1nv1s1bl3_pl@y3r") {
    // For regular voting, check if voter and target are valid players
    if (!session.players.has(voter) && session.voteType !== "mafia") {
      console.log(`[DEBUG] Voter ${voter} not in players list`);
      validVote = false;
    }
    
    if (!session.players.has(target)) {
      console.log(`[DEBUG] Target ${target} not in players list`);
      validVote = false;
    }
  }
  
  if (!validVote) {
    console.warn(`[VOTING] Invalid vote: ${voter} -> ${target} not recognized in session ${voteId}.`);
    return;
  }

  // Record the vote
  session.votes[voter] = target;
  console.log(`[VOTING] ${voter} voted for ${target} in session ${voteId} (Lobby ${lobbyId}).`);
  
  // Log the session after vote
  console.log(`[VOTING SERVICE] Session after voting: votes:`, session.votes);
}

function calculateResults(lobbyId, voteId) {
  const session = votingSessions[lobbyId]?.find((s) => s.voteId === voteId);
  if (!session) return null;

  // Log the full votes for debugging
  console.log(`[VOTING] Calculating results for session ${voteId}. Votes:`, session.votes);

  const voteCounts = {};
  for (const target of Object.values(session.votes)) {
    voteCounts[target] = (voteCounts[target] || 0) + 1;
  }

  // Log vote counts for debugging
  console.log(`[VOTING] Vote counts:`, voteCounts);

  let maxVotes = 0;
  let candidate = null;
  let tie = false;

  // Determine which candidate received the highest number of votes
  for (const [target, count] of Object.entries(voteCounts)) {
    console.log("[VOTING SERVICE]", target, count);
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
      `[VOTING] session ${voteId} in lobby ${lobbyId} ended with a tie or abstention. Tie: ${tie}, MaxVotes: ${maxVotes}`
    );
    return null;
  }

  console.log(`[VOTING] session ${voteId} in lobby ${lobbyId} ended. Eliminated: ${candidate} with ${maxVotes} votes`);
  return candidate;
}

function endVoting(lobbyId, voteId) {
  const sessionIndex = votingSessions[lobbyId]?.findIndex((s) => s.voteId === voteId);
  if (sessionIndex === -1 || sessionIndex === undefined) return null;

  const session = votingSessions[lobbyId][sessionIndex];
  const voteType = session.voteType;
  const eliminatedPlayer = calculateResults(lobbyId, voteId);

  // Initialize nightVotes object for this lobby if it doesn't exist
  if (!nightVotes[lobbyId]) {
    nightVotes[lobbyId] = { mafia: null, doctor: null, detective: null };
  }

  // Handle different vote types
  if (voteType === "mafia") {
    // Store mafia vote, but don't eliminate yet
    if (eliminatedPlayer) {
      nightVotes[lobbyId].mafia = eliminatedPlayer;
      console.log(`[VOTING] Mafia selected ${eliminatedPlayer} to eliminate`);
    }
  } else if (voteType === "doctor") {
    // Store doctor vote
    if (eliminatedPlayer) {
      nightVotes[lobbyId].doctor = eliminatedPlayer;
      console.log(`[VOTING] Doctor selected ${eliminatedPlayer} to save`);
    }
  } else if (voteType === "detective") {
    // This section is now handled directly in the socket handler
    // We no longer process detective votes here
    console.log(`[VOTING] Detective vote processing skipped in endVoting - handled separately now`);
    return null;
  } else {
    // Regular voting (day phase)
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
  }

  // Remove session
  votingSessions[lobbyId].splice(sessionIndex, 1);
  
  // Check if all night phase votes are complete
  if (voteType !== "villager") {
    const allVotesComplete = checkAllNightVotesComplete(lobbyId);
    if (allVotesComplete) {
      return processNightResults(lobbyId);
    }
  }
  
  return eliminatedPlayer;
}

// Helper function to check if all night votes have been cast
function checkAllNightVotesComplete(lobbyId) {
  // Get lobby to check which roles exist
  const lobby = lobbyService.getLobby(lobbyId);
  if (!lobby) {
    console.log('[VOTING] No lobby found for checking night votes completion');
    return false;
  }
  
  // Check if votes object exists
  if (!nightVotes[lobbyId]) {
    console.log('[VOTING] No night votes object exists for lobby');
    nightVotes[lobbyId] = { mafia: null, doctor: null, detective: null };
  }
  
  // Required votes
  let mafiaExists = false;
  let doctorExists = false;
  let detectiveExists = false;
  
  // Check which roles exist in the game
  lobby.players.forEach(player => {
    if (player.isAlive) {
      if (player.role?.toLowerCase() === "mafia") mafiaExists = true;
      if (player.role?.toLowerCase() === "doctor") doctorExists = true;
      if (player.role?.toLowerCase() === "detective") detectiveExists = true;
    }
  });
  
  console.log(`[VOTING] Alive roles in game - Mafia: ${mafiaExists}, Doctor: ${doctorExists}, Detective: ${detectiveExists}`);
  console.log(`[VOTING] Current votes - Mafia: ${nightVotes[lobbyId].mafia}, Doctor: ${nightVotes[lobbyId].doctor}, Detective: ${nightVotes[lobbyId].detective}`);
  
  // Check if all roles have voted or abstained
  const mafiaVoted = !mafiaExists || nightVotes[lobbyId].mafia !== null;
  const doctorVoted = !doctorExists || nightVotes[lobbyId].doctor !== null;
  const detectiveVoted = !detectiveExists || nightVotes[lobbyId].detective !== null;
  
  console.log(`[VOTING] Night votes status - Mafia: ${mafiaVoted}, Doctor: ${doctorVoted}, Detective: ${detectiveVoted}`);
  
  return mafiaVoted && doctorVoted && detectiveVoted;
}

// Process the results of all night votes
function processNightResults(lobbyId) {
  const votes = nightVotes[lobbyId];
  if (!votes) return null;
  
  let eliminatedPlayer = null;
  
  // Check if doctor saved the mafia target
  if (votes.mafia && votes.doctor && votes.mafia === votes.doctor) {
    console.log(`[VOTING] Doctor saved ${votes.mafia} from elimination`);
    eliminatedPlayer = null; // No elimination if doctor saved the target
  } else if (votes.mafia) {
    // Mafia kill proceeds if no doctor save
    eliminatedPlayer = votes.mafia;
    eliminatedPlayers[lobbyId].add(eliminatedPlayer);
    
    // Mark them as not alive in the lobby
    const lobby = lobbyService.getLobby(lobbyId);
    if (lobby) {
      const p = lobby.players.find((pl) => pl.username === eliminatedPlayer);
      if (p) {
        p.isAlive = false;
      }
    }
    console.log(`[VOTING] Player ${eliminatedPlayer} was eliminated by the Mafia`);
  }
  
  // Reset night votes for next night
  nightVotes[lobbyId] = { mafia: null, doctor: null, detective: null };
  
  // Return necessary information about night results
  return {
    type: "night_results",
    eliminated: eliminatedPlayer,
    detectiveTarget: votes.detective
  };
}

function getVotingSessions(lobbyId) {
  return votingSessions[lobbyId] || [];
}

function getSession(lobbyId, voteId) {
  return votingSessions[lobbyId]?.find((s) => s.voteId === voteId) || null;
}

function storeDetectiveResult(lobbyId, target) {
  if (!nightVotes[lobbyId]) {
    nightVotes[lobbyId] = { mafia: null, doctor: null, detective: null };
  }
  
  nightVotes[lobbyId].detective = target;
  detectiveResults[lobbyId] = target;
  console.log(`[VOTING] Detective result stored: ${target} in lobby ${lobbyId}`);
  return true;
}

function recordNightVote(lobbyId, voteType, target) {
  if (!nightVotes[lobbyId]) {
    nightVotes[lobbyId] = { mafia: null, doctor: null, detective: null };
  }
  
  nightVotes[lobbyId][voteType] = target;
  console.log(`[VOTING] ${voteType} vote recorded: ${target} in lobby ${lobbyId}`);
  return true;
}

function getVotingSessionIndex(lobbyId, voteId) {
  if (!votingSessions[lobbyId]) return -1;
  
  const index = votingSessions[lobbyId].findIndex((s) => s.voteId === voteId);
  console.log(`[VOTING] Found voting session index ${index} for voteId ${voteId}`);
  return index; // Will be -1 if not found
}

function removeVotingSession(lobbyId, sessionIndex) {
  if (sessionIndex !== -1 && votingSessions[lobbyId] && sessionIndex < votingSessions[lobbyId].length) {
    console.log(`[VOTING] Removing voting session at index ${sessionIndex} in lobby ${lobbyId}`);
    votingSessions[lobbyId].splice(sessionIndex, 1);
    return true;
  }
  return false;
}

function clearVotingSessions(lobbyId) {
  if (votingSessions[lobbyId]) {
    console.log(`[VOTING] Clearing all voting sessions for lobby ${lobbyId}`);
    votingSessions[lobbyId] = [];
    return true;
  }
  return false;
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
  checkAllNightVotesComplete,
  processNightResults,
  nightVotes,
  storeDetectiveResult,
  recordNightVote,
  getVotingSessionIndex,
  removeVotingSession,
  clearVotingSessions,
  getLobby
};
