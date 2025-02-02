// server/socket/lobbySocket.js
/*
lobbySocket.js
Description:
Manages WebSocket events for the lobby system.
Key Responsibilities:
Handle lobby creation, joining, and updates.
Broadcast lobby status to all players in the room.
Check if the lobby meets the requirements to start a game.
*/
const lobbyService = require('../services/lobbyService');
const roleService = require('../services/roleService');

function initLobbySocket(io) {
  // Initialize the lobbyService with the Socket.IO instance
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

        // Notify everyone in the lobby
        io.to(lobbyId).emit('lobbyUpdated', { players });

        console.log(`${username} (Socket: ${socket.id}) joined lobby: ${lobbyId}`);
        
        // Check if the lobby can start
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
        // 1. Mark the game as started
        lobbyService.startGame(lobbyId, socket.id);

        // 2. Begin the Day/Night cycle
        lobbyService.startDayNightCycle(lobbyId);

        // 3. Assign roles
        roleService.assignRoles(lobbyId);

        // 4. Notify all players the chatroom can start
        io.to(lobbyId).emit('startChatroom', { lobbyId });

        // 5. Send each player their role
        const lobby = lobbyService.getLobby(lobbyId);
        lobby.players.forEach(player => {
          console.log(`Sending role to ${player.socketId}: ${player.role}`);
          io.to(player.socketId).emit('roleAssigned', {
            role: player.role,
            players: lobby.players.map(p => ({
              id: p.socketId,
              name: p.username,
              isAlive: p.isAlive
            }))
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

      // If the player was in a lobby, update the rest
      if (updateInfo && updateInfo.lobbyId) {
        const { lobbyId, players, newCreator } = updateInfo;

        if (newCreator) {
          // Alert the newly assigned creator
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