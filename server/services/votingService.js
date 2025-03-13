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

  if (voteType === "mafia") {
    // Populate candidates: all players
    lobby.players.forEach(player => {
      if (player.role.toLowerCase() !== "mafia"){
        newSession.players.add(player.username);
      }
      // if (player.isAlive && !eliminatedPlayers[lobbyId].has(player.username)) {
      //   newSession.players.add(player.username);
      // }
    });

    // Populate voters: only mafia members should vote
    lobby.players.forEach(player => {
      if (player.isAlive &&
          !eliminatedPlayers[lobbyId].has(player.username) &&
          player.role && player.role.toLowerCase() === "mafia") {
        newSession.voters.add(player.username);
      }
    });
  } else {
    lobby.players.forEach(player => {
      // all players are candidates
      newSession.players.add(player.username);
      if (player.isAlive && !eliminatedPlayers[lobbyId].has(player.username)) {
        // only active ones can cast vote
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
  // when mafia vote, votingSession does not contain mafia by default
  if ((!session.players.has(voter) && session.voteType !== "mafia") || 
        (target !== "s3cr3t_1nv1s1bl3_pl@y3r" && !session.players.has(target))) {
      console.log(`[DEBUG] hasVoter: ${session.players.has(voter)}`)
      console.log(`[DEBUG] hasTarget: ${session.players.has(target)}`)
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
  if (tie || candidate === "s3cr3t_1nv1s1bl3_pl@y3r") {
    console.log(
      `[VOTING] session ${voteId} in lobby ${lobbyId} ended with a tie or abstention.`
    );
    return null;
  }

  // If maxVotes less than half of the voters, no one is eliminated
  num_voters = session.voters.size
  if (maxVotes < num_voters / 2){
    console.log(
      `[VOTING] session ${voteId} in lobby ${lobbyId} ended with non-majority vote. The maxVote was ${maxVotes} given ${num_voters} voters`
    );
    return null;
  }

  console.log(`[VOTING] session ${voteId} in lobby ${lobbyId} ended. Eliminated: ${candidate}`);
  return candidate;
}
  
function checkWinCondition(lobbyId) {
  const lobby = lobbyService.getLobby(lobbyId);
  if (!lobby) return null;

  let mafiaCount = 0;
  let villagerCount = 0;

  lobby.players.forEach(player => {
    if (!player.isAlive) return; // Ignore dead players
    if (player.role.toLowerCase() === "mafia") {
      mafiaCount++;
    } else {
      villagerCount++;
    }
  });

  if (mafiaCount === 0) {
    console.log(`[GAME OVER] Villagers win! All mafia eliminated.`);
    return "villagers";
  }

  if (mafiaCount >= villagerCount) {
    console.log(`[GAME OVER] Mafia wins! They outnumber the villagers.`);
    return "mafia";
  }

  return null; // No winner yet
}
  

  function endVoting(lobbyId, voteId) {
    const sessionIndex = votingSessions[lobbyId]?.findIndex((s) => s.voteId === voteId);
    if (sessionIndex === -1 || sessionIndex === undefined)
      return { eliminated: null, winner: null };
  
    const eliminatedPlayer = calculateResults(lobbyId, voteId);
  
    if (eliminatedPlayer) {
      eliminatedPlayers[lobbyId].add(eliminatedPlayer);
      const lobby = lobbyService.getLobby(lobbyId);
      if (lobby) {
        const p = lobby.players.find(pl => pl.username === eliminatedPlayer);
        if (p) {
          p.isAlive = false;
        }
      }
    }
  
    // Remove the voting session
    votingSessions[lobbyId].splice(sessionIndex, 1);
  
    const winner = checkWinCondition(lobbyId);
    if (winner) {
      console.log(`[GAME OVER] ${winner.toUpperCase()} wins the game.`);
    }
  
    return { eliminated: eliminatedPlayer, winner };
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
