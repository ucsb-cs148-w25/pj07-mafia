const VotingSession = require("../models/votingModel");
const lobbyService = require("../services/lobbyService");
const { v4: uuidv4 } = require("uuid");

const votingSessions = {}; // stores active sessions, keyed by lobbyId (each value is an array of sessions)
const eliminatedPlayers = {}; // stores eliminated players for each lobby, as a Set

/**
 * Start a new voting session.
 * @param {string} lobbyId - The lobby identifier.
 * @param {string} voteType - "villager" or "mafia"
 * @returns {string|null} - The unique vote session ID.
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
    console.warn(`[VOTING] Attempted to start voting for a non-existent lobby ${lobbyId}.`);
    return null;
  }

  // Populate eligible voters based on vote type.
  if (voteType === "mafia") {
    // Only mafia players are allowed to vote in a mafia kill vote.
    lobby.players.forEach((player) => {
      if (
        player.role &&
        player.role.toLowerCase() === "mafia" &&
        !eliminatedPlayers[lobbyId].has(player.username)
      ) {
        newSession.players.add(player.username);
      }
    });
  } else {
    // Villager vote: every active (non-eliminated) player can vote.
    lobby.players.forEach((player) => {
      if (!eliminatedPlayers[lobbyId].has(player.username)) {
        newSession.players.add(player.username);
      }
    });
  }

  votingSessions[lobbyId].push(newSession);
  console.log(
    `[VOTING] New voting session started for lobby ${lobbyId} (Type: ${voteType}). Eligible voters:`,
    Array.from(newSession.players)
  );
  return voteId;
}

/**
 * Record a vote in an active voting session.
 * @param {string} lobbyId 
 * @param {string} voteId 
 * @param {string} voter 
 * @param {string} target 
 */
function castVote(lobbyId, voteId, voter, target) {
  const session = votingSessions[lobbyId]?.find((s) => s.voteId === voteId);
  if (!session) {
    console.warn(`[VOTING] No active voting session with ID ${voteId} found in lobby ${lobbyId}.`);
    return;
  }

  // Prevent duplicate voting.
  if (session.votes.hasOwnProperty(voter)) {
    console.warn(`[VOTING] Duplicate vote from ${voter} in voting session ${voteId} (Lobby ${lobbyId}).`);
    return;
  }

  // Validate that both voter and target are among eligible players.
  if (!session.players.has(voter) || !session.players.has(target)) {
    console.warn(
      `[VOTING] Invalid vote: ${voter} -> ${target} (Lobby ${lobbyId}, Vote ${voteId}).`
    );
    return;
  }

  session.votes[voter] = target;
  console.log(
    `[VOTING] ${voter} voted for ${target} in voting session ${voteId} (Lobby ${lobbyId}).`
  );
}

/**
 * Calculate the voting results.
 * Returns the player with the most votes, or null if there is a tie or no votes.
 * @param {string} lobbyId 
 * @param {string} voteId 
 * @returns {string|null}
 */
function calculateResults(lobbyId, voteId) {
  const session = votingSessions[lobbyId]?.find((s) => s.voteId === voteId);
  if (!session) return null;

  const voteCounts = {};
  for (const target of Object.values(session.votes)) {
    voteCounts[target] = (voteCounts[target] || 0) + 1;
  }

  let maxVotes = 0;
  let candidates = [];
  for (const [player, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      candidates = [player];
    } else if (count === maxVotes) {
      candidates.push(player);
    }
  }

  // If tie or no clear majority, no one is eliminated.
  if (candidates.length !== 1) {
    console.log(
      `[VOTING] Voting session ${voteId} in lobby ${lobbyId} ended with a tie or no clear majority.`
    );
    return null;
  }

  console.log(
    `[VOTING] Voting session ${voteId} in lobby ${lobbyId} ended. Eliminated: ${candidates[0]}`
  );
  return candidates[0];
}

/**
 * End a voting session and return the eliminated player (if any).
 * @param {string} lobbyId 
 * @param {string} voteId 
 * @returns {string|null}
 */
function endVoting(lobbyId, voteId) {
  const sessionIndex = votingSessions[lobbyId]?.findIndex((s) => s.voteId === voteId);
  if (sessionIndex === -1 || sessionIndex === undefined) return null;

  const eliminatedPlayer = calculateResults(lobbyId, voteId);
  if (eliminatedPlayer) {
    eliminatedPlayers[lobbyId].add(eliminatedPlayer);
  }
  // Remove the voting session once finished.
  votingSessions[lobbyId].splice(sessionIndex, 1);
  return eliminatedPlayer;
}

/**
 * Get all active voting sessions for a given lobby.
 * @param {string} lobbyId 
 * @returns {Array}
 */
function getVotingSessions(lobbyId) {
  return votingSessions[lobbyId] || [];
}

/**
 * Retrieve a specific voting session.
 * @param {string} lobbyId 
 * @param {string} voteId 
 * @returns {object|null}
 */
function getSession(lobbyId, voteId) {
  const session = votingSessions[lobbyId]?.find((s) => s.voteId === voteId);
  return session || null;
}

module.exports = {
  startVoting,
  castVote,
  endVoting,
  getVotingSessions,
  getSession
};