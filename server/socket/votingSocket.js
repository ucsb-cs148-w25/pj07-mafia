const { VOTING_DURATION, NIGHT_DURATION } = require("../constants");
const VotingService = require("../services/votingService");
const lobbyService = require("../services/lobbyService");

// Object to track if a vote has already been ended
const endedVotes = {};

function concludeVoting(io, lobbyId, voteId, voteType) {
  const result = VotingService.endVoting(lobbyId, voteId);
  io.to(lobbyId).emit("voting_complete", { eliminated: result.eliminated, winner: result.winner });
  
  let msg;
  if (result.eliminated) {
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

function checkAndConclude(io, lobbyId, voteId, session) {
  // For mafia vote type, conclude only when all three groups have voted.
  if (session.voteType === "mafia") {
    console.log( `[CHECK] Mafias: ${session.voters.size}; Doctors: ${session.doctorVoters.size}; Detectives: ${session.detectiveVoters.size}` );

    // Immediately send detective investigation result when all detective votes are in
    if (Object.keys(session.detectiveVotes).length === session.detectiveVoters.size && !session.detectiveResultEmitted) {
      // Calculate detective result using the generic function from votingService
      const detectiveResult = VotingService.calculateResultGeneric(session.detectiveVotes, session.detectiveVoters.size);
      const lobby = lobbyService.getLobby(lobbyId);
      const detectiveCandidate = lobby.players.find(p => p.username === detectiveResult);
      let isSuspicious = false;
      if (detectiveCandidate && 
        (detectiveCandidate.role.toLowerCase() === "mafia") || !detectiveCandidate.isAlive) {
        // is mafia or died
        isSuspicious = true;
      }
      const detectiveMsg = isSuspicious
        ? `Investigation clear… ${detectiveResult} is suspicious.`
        : `Investigation clear… ${detectiveResult} seems safe… for now.`;
      io.to(`${lobbyId}_detectives`).emit("detective_private_message", {
          sender: "[DETECTIVE RESULT]",
          text: detectiveMsg,
          timestamp: new Date()
        });
      session.detectiveResultEmitted = true;
    }

    if (
      Object.keys(session.votes).length === session.voters.size && // all Mafias voted
      Object.keys(session.doctorVotes).length === session.doctorVoters.size &&// all doctors voted
      Object.keys(session.detectiveVotes).length === session.detectiveVoters.size // all detectives voted
    ) {
      console.log("[VOTING] All mafia, doctor, and detective votes submitted. Ending voting session.");
      concludeVoting(io, lobbyId, voteId, session.voteType);
    }
  } else {
    // For other vote types, use the standard check.
    if (Object.keys(session.votes).length === session.voters.size) {
      console.log("[VOTING] All votes submitted. Ending voting session.");
      concludeVoting(io, lobbyId, voteId, session.voteType);
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

      let session;
      let voteId;
      const activeSessions = VotingService.getVotingSessions(lobbyId);
      if (activeSessions && activeSessions.length > 0) {
        // If a voting session is already active, reuse it.
        session = activeSessions[0];
        voteId = session.voteId || activeSessions[0].id; // adjust based on your implementation
        console.log(
          `[VOTING] Active voting session exists for lobby ${lobbyId}. Sending existing vote info.`
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
        const duration = voteType === "villager"? VOTING_DURATION : NIGHT_DURATION
        setTimeout(() => {
          const currentSession = VotingService.getSession(lobbyId, voteId);
          if (currentSession) {
            console.log("[TIMEOUT] Time limit reached. Ending voting session.");
            concludeVoting(io, lobbyId, voteId, voteType);
          }
        }, duration * 1000);
      }
      // Send the voting interface event only to the requesting client
      socket.emit("open_voting", {
        voteType,
        voteId,
        players: Array.from(session.players)
      });
    });

    // Handler for submitting a mafia (or villager) vote.
    socket.on("submit_vote", ({ lobbyId, voteId, voter, target }) => {
      socket.join(lobbyId);
      if (!lobbyId || !voteId || !voter || !target) {
        console.warn("[VOTING] Incomplete vote submission.");
        return;
      }

      VotingService.castVote(lobbyId, voteId, voter, target);
      const session = VotingService.getSession(lobbyId, voteId);
      if (session) {
        checkAndConclude(io, lobbyId, voteId, session);
      }
    });

    // Handler for submitting a doctor vote.
    socket.on("submit_doctor_vote", ({ lobbyId, voteId, voter, target }) => {
      socket.join(lobbyId);
      if (!lobbyId || !voteId || !voter || !target) {
        console.warn("[VOTING] Incomplete doctor vote submission.");
        return;
      }
      VotingService.castDoctorVote(lobbyId, voteId, voter, target);
      const session = VotingService.getSession(lobbyId, voteId);
      if (session) {
        checkAndConclude(io, lobbyId, voteId, session);
      }
    });

    // Handler for submitting a detective vote.
    socket.on("submit_detective_vote", ({ lobbyId, voteId, voter, target }) => {
      socket.join(lobbyId);
      if (!lobbyId || !voteId || !voter || !target) {
        console.warn("[VOTING] Incomplete detective vote submission.");
        return;
      }
      VotingService.castDetectiveVote(lobbyId, voteId, voter, target);
      const session = VotingService.getSession(lobbyId, voteId);
      if (session) {
        checkAndConclude(io, lobbyId, voteId, session);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[VOTING SOCKET] ${socket.id} disconnected.`);
    });
  });
}

module.exports = { initVotingSocket };