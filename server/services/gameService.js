const lobbyService = require("./lobbyService");

class GameService {
  constructor(io) {
    this.io = io; // Store socket.io reference
  }

  /** Start Game */
  startGame(lobbyId) {
    const lobby = lobbyService.getLobby(lobbyId);
    if (!lobby || lobby.hasStarted) return;

    lobby.hasStarted = true;
    this.startDayPhase(lobby);
  }

  /** Start the 'Day' Phase */
  startDayPhase(lobby) {
    lobby.phase = "day";
    lobby.timer = 60;

    console.log(`[Lobby ${lobby.id}] Day phase started!`);
    this.io.to(lobby.id).emit("phaseChange", { phase: lobby.phase, timer: lobby.timer });

    this.startTimer(lobby, () => this.startNightPhase(lobby));
  }

  /** Start the 'Night' Phase */
  startNightPhase(lobby) {
    lobby.phase = "night";
    lobby.timer = 30;

    console.log(`[Lobby ${lobby.id}] Night phase started!`);
    this.io.to(lobby.id).emit("phaseChange", { phase: lobby.phase, timer: lobby.timer });

    this.startTimer(lobby, () => this.startDayPhase(lobby));
  }

  /** Timer Function */
  startTimer(lobby, nextPhaseCallback) {
    if (lobby.timerInterval) clearInterval(lobby.timerInterval);

    lobby.timerInterval = setInterval(() => {
      lobby.timer -= 1;
      this.io.to(lobby.id).emit("timerUpdate", { timer: lobby.timer });

      if (lobby.timer <= 0) {
        clearInterval(lobby.timerInterval);
        lobby.timerInterval = null;
        nextPhaseCallback(); // Move to next phase
      }
    }, 1000);
  }
}

module.exports = GameService;