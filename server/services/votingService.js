// server/services/votingService.js

const VotingSession = require("../models/votingModel");
const lobbyService = require("./lobbyService");
const { v4: uuidv4 } = require("uuid");

const votingSessions = {};        // { [lobbyId]: VotingSession[] }
const eliminatedPlayers = {};     // { [lobbyId]: Set of usernames }
const nightVotes = {};            // { [lobbyId]: { mafia: target, doctor: target, detective: target } }

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

  // For special night roles, handle differently
  if (voteType === "mafia" || voteType === "doctor" || voteType === "detective") {
    // Populate candidates: all alive players except eliminated ones
    lobby.players.forEach(player => {
      if (player.isAlive && !eliminatedPlayers[lobbyId].has(player.username)) {
        newSession.players.add(player.username);
      }
    });

    // Populate voters: only players with matching role should vote
    lobby.players.forEach(player => {
      if (player.isAlive &&
          !eliminatedPlayers[lobbyId].has(player.username) &&
          player.role && player.role.toLowerCase() === voteType.toLowerCase()) {
        newSession.voters.add(player.username);
      }
    });
  } else {
    // Regular voting (during day phase)
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

  console.log(`[VOTING] session ${voteId} in lobby ${lobbyId} ended. Eliminated: ${candidate}`);
  return candidate;
}

function endVoting(lobbyId, voteId) {
  const sessionIndex = votingSessions[lobbyId]?.findIndex((s) => s.voteId === voteId);
  if (sessionIndex === -1 || sessionIndex === undefined) return null;
  
  const session = votingSessions[lobbyId][sessionIndex];
  const eliminatedPlayer = calculateResults(lobbyId, voteId);
  
  // Initialize nightVotes object for this lobby if it doesn't exist
  if (!nightVotes[lobbyId]) {
    nightVotes[lobbyId] = {};
  }
  
  // Handle voting based on vote type
  if (session.voteType === "mafia") {
    // Store mafia vote target for later processing at the end of night
    if (eliminatedPlayer) {
      nightVotes[lobbyId].mafia = eliminatedPlayer;
      console.log(`[NIGHT] Mafia chose to eliminate ${eliminatedPlayer}`);
    }
  } else if (session.voteType === "doctor") {
    // Store the player the doctor chose to save
    if (eliminatedPlayer) {
      nightVotes[lobbyId].doctor = eliminatedPlayer;
      console.log(`[NIGHT] Doctor chose to save ${eliminatedPlayer}`);
    }
  } else if (session.voteType === "detective") {
    // Store the player the detective chose to investigate
    if (eliminatedPlayer) {
      nightVotes[lobbyId].detective = eliminatedPlayer;
      
      // Send investigation result to the detective
      const lobby = lobbyService.getLobby(lobbyId);
      if (lobby) {
        // Find the detective player
        const detective = lobby.players.find(p => 
          p.isAlive && p.role && p.role.toLowerCase() === "detective");
        
        if (detective) {
          // Check if the investigated player is mafia
          const investigatedPlayer = lobby.players.find(p => p.username === eliminatedPlayer);
          const isMafia = investigatedPlayer && 
                          investigatedPlayer.role && 
                          investigatedPlayer.role.toLowerCase() === "mafia";
          
          // Store investigation result in nightVotes
          nightVotes[lobbyId].detectiveResult = {
            target: eliminatedPlayer,
            isMafia,
            detectiveSocketId: detective.socketId
          };
          
          console.log(`[NIGHT] Detective investigated ${eliminatedPlayer}. Result: ${isMafia ? 'Mafia' : 'Not Mafia'}`);
        }
      }
    }
  } else if (session.voteType === "villager") {
    // Regular day voting - eliminate player immediately
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
  return eliminatedPlayer;
}

function getVotingSessions(lobbyId) {
  return votingSessions[lobbyId] || [];
}

function getSession(lobbyId, voteId) {
  return votingSessions[lobbyId]?.find((s) => s.voteId === voteId) || null;
}

/**
 * Process all night votes at the end of the night phase.
 * This includes:
 * 1. Send investigation results to detective
 * 2. Check if mafia's target was saved by the doctor
 * 3. Eliminate the target if they weren't saved
 * 
 * @param {string} lobbyId - ID of the lobby
 * @param {object} io - Socket.io instance for sending messages
 * @returns {object} - Information about what happened during the night
 */
function processNightVotes(lobbyId, io) {
  console.log(`[NIGHT] Processing night votes for lobby ${lobbyId}`);
  const results = { 
    playerEliminated: null,
    playerSaved: false,
    investigation: null
  };
  
  if (!nightVotes[lobbyId]) {
    console.log(`[NIGHT] No night votes found for lobby ${lobbyId}`);
    return results;
  }
  
  const votes = nightVotes[lobbyId];
  console.log(`[NIGHT] Votes for lobby ${lobbyId}:`, votes);
  
  // Process detective investigation result
  if (votes.detectiveResult) {
    const { target, isMafia, detectiveSocketId } = votes.detectiveResult;
    
    // Send private message to the detective with investigation result
    if (io && detectiveSocketId) {
      io.to(detectiveSocketId).emit("message", {
        sender: "System",
        text: `Your investigation reveals that ${target} is ${isMafia ? 'a member of the Mafia!' : 'not a member of the Mafia.'}`,
        timestamp: new Date(),
        isPrivate: true
      });
      
      results.investigation = {
        target,
        result: isMafia ? "Mafia" : "Not Mafia" 
      };
      
      console.log(`[NIGHT] Sent investigation result to detective about ${target}`);
    }
  }
  
  // Process mafia and doctor votes
  if (votes.mafia) {
    const targetPlayer = votes.mafia;
    
    // Check if the doctor saved the mafia's target
    if (votes.doctor && votes.doctor === targetPlayer) {
      console.log(`[NIGHT] Doctor saved ${targetPlayer} from elimination`);
      results.playerSaved = true;
      
      // Notify all players that someone was saved (without revealing who)
      if (io) {
        io.to(lobbyId).emit("message", {
          sender: "System",
          text: `A player was targeted in the night but was saved by swift medical intervention.`,
          timestamp: new Date()
        });
      }
    } else {
      // Target wasn't saved, eliminate them
      console.log(`[NIGHT] ${targetPlayer} was eliminated by the Mafia`);
      results.playerEliminated = targetPlayer;
      
      // Mark player as eliminated
      eliminatedPlayers[lobbyId].add(targetPlayer);
      
      // Mark them as not alive in the lobby
      const lobby = lobbyService.getLobby(lobbyId);
      if (lobby) {
        const p = lobby.players.find((pl) => pl.username === targetPlayer);
        if (p) {
          p.isAlive = false;
        }
      }
      
      // We don't notify players here, as this will be handled by the voting socket
    }
  }
  
  // Clear night votes for this lobby
  nightVotes[lobbyId] = {};
  
  return results;
}

module.exports = {
  startVoting,
  castVote,
  endVoting,
  getVotingSessions,
  getSession,
  processNightVotes,
};
