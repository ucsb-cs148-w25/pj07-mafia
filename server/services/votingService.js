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

  // Build the list of who can vote
  if (voteType === "mafia") {
    // only mafia + alive + not in eliminatedPlayers
    lobby.players.forEach((player) => {
      if (!player.isAlive) {
        console.log(`[DEBUG] Skipping ${player.username} (not alive).`);
        return;
      }
      if (eliminatedPlayers[lobbyId].has(player.username)) {
        console.log(`[DEBUG] Skipping ${player.username} (already eliminated).`);
        return;
      }
      if (player.role && player.role.toLowerCase() === "mafia") {
        newSession.players.add(player.username);
      } else {
        console.log(`[DEBUG] Skipping ${player.username} (not mafia).`);
      }
    });
  } else {
    // villager vote => all alive, non-eliminated players
    lobby.players.forEach((player) => {
      if (!player.isAlive) {
        console.log(`[DEBUG] Skipping ${player.username} (not alive).`);
        return;
      }
      if (eliminatedPlayers[lobbyId].has(player.username)) {
        console.log(`[DEBUG] Skipping ${player.username} (already eliminated).`);
        return;
      }
      // For "villager," we do NOT check role. So a new joiner with no role is still included if alive.
      newSession.players.add(player.username);
    });
  }

  votingSessions[lobbyId].push(newSession);

  console.log(
    `[VOTING] New voting session started in lobby ${lobbyId} (Type: ${voteType}). Eligible voters:`,
    Array.from(newSession.players)
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
  if (!session.players.has(voter) || !session.players.has(target)) {
    console.warn(`[VOTING] Invalid vote: ${voter} -> ${target} not recognized in session ${voteId}.`);
    return;
  }

  session.votes[voter] = target;
  console.log(`[VOTING] ${voter} voted for ${target} in session ${voteId} (Lobby ${lobbyId}).`);
}

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

  // Tie or no majority => null
  if (candidates.length !== 1) {
    console.log(`[VOTING] session ${voteId} in lobby ${lobbyId} ended with a tie or no majority.`);
    return null;
  }

  console.log(`[VOTING] session ${voteId} in lobby ${lobbyId} ended. Eliminated: ${candidates[0]}`);
  return candidates[0];
}

function endVoting(lobbyId, voteId) {
  const sessionIndex = votingSessions[lobbyId]?.findIndex((s) => s.voteId === voteId);
  if (sessionIndex === -1 || sessionIndex === undefined) return null;

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

  // Remove session
  votingSessions[lobbyId].splice(sessionIndex, 1);
  return eliminatedPlayer;
}

function getVotingSessions(lobbyId) {
  return votingSessions[lobbyId] || [];
}

function getSession(lobbyId, voteId) {
  return votingSessions[lobbyId]?.find((s) => s.voteId === voteId) || null;
}

module.exports = {
  startVoting,
  castVote,
  endVoting,
  getVotingSessions,
  getSession,
};
