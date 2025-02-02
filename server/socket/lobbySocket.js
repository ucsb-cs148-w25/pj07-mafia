// server/socket/lobbySocket.js
/*
lobbySocket.js
Manages WebSocket events for the lobby system.
*/

const lobbyService = require('../services/lobbyService');
const roleService = require('../services/roleService');

function initLobbySocket(io) {
  lobbyService.initialize(io);

  io.on('connection', (socket) => {
    console.log('New client connected for LOBBY:', socket.id);

    // 1. Create Lobby
    socket.on('createLobby', (username) => {
      const { lobbyId, players } = lobbyService.createLobby(socket.id, username);

      // Join the Socket.IO room
      socket.join(lobbyId);

      // Emit to the creator only
      socket.emit('lobbyCreated', {
        lobbyId,
        players,
        isCreator: true,
      });

      console.log(`Lobby created with ID: ${lobbyId} by ${username}`);
    });

    // 2. Join Lobby
    socket.on('joinLobby', ({ lobbyId, username }) => {
      try {
        const players = lobbyService.joinLobby(lobbyId, socket.id, username);
        socket.join(lobbyId);

        io.to(lobbyId).emit('lobbyUpdated', { players });
        console.log(`${username} (Socket: ${socket.id}) joined lobby: ${lobbyId}`);

        // 🔥 The correct check:
        if (lobbyService.canStart(lobbyId)) {
          io.to(lobbyId).emit('lobbyReady', {
            players,
            isReady: true,
          });
          console.log(`Lobby ${lobbyId} is ready to start.`);
        }

      } catch (error) {
        socket.emit('lobbyError', { message: error.message });
      }
    });

    // 3. Start Game
    socket.on('startGame', (lobbyId) => {
      try {
        lobbyService.startGame(lobbyId, socket.id);
        lobbyService.startDayNightCycle(lobbyId);
        roleService.assignRoles(lobbyId);

        // Notify all players the chatroom can start
        io.to(lobbyId).emit('startChatroom', { lobbyId });

        // Send each player their role
        const lobby = lobbyService.getLobby(lobbyId);
        lobby.players.forEach((player) => {
          console.log(`Sending role to ${player.socketId}: ${player.role}`);
          io.to(player.socketId).emit('roleAssigned', {
            role: player.role,
            players: lobby.players.map(p => ({
              id: p.socketId,
              name: p.username,
              isAlive: p.isAlive,
            })),
          });
        });

      } catch (error) {
        socket.emit('lobbyError', { message: error.message });
      }
    });

    // 4. Disconnect Handler
    socket.on('disconnect', () => {
      console.log('Client disconnected from LOBBY:', socket.id);
      const updateInfo = lobbyService.removePlayer(socket.id);

      if (updateInfo && updateInfo.lobbyId) {
        const { lobbyId, players, newCreator } = updateInfo;

        if (newCreator) {
          io.to(newCreator).emit('creatorAssigned', {
            message: 'You are now the lobby creator.',
          });
          console.log(`New creator for lobby ${lobbyId}: ${newCreator}`);
        }

        if (players && players.length > 0) {
          io.to(lobbyId).emit('lobbyUpdated', { players });
        } else {
          console.log(`Lobby ${lobbyId} deleted (no players left).`);
        }
      }
    });
  });
}

module.exports = { initLobbySocket };
