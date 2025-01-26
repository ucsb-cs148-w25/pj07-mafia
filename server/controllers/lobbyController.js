// server/controllers/lobbyController.js

const { v4: uuidv4 } = require('uuid');

module.exports = (io) => {
  // In-memory storage for lobbies
  let lobbies = {};
  const MIN_PLAYERS = 3;

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Handle "createLobby" event
    socket.on('createLobby', (username) => {
      const lobbyId = uuidv4(); // Generate a unique lobby ID
      lobbies[lobbyId] = {
        id: lobbyId,
        creator: socket.id, // Track the lobby creator
        players: [{ id: socket.id, name: username }],
        hasStarted: false, // To prevent multiple game starts
      };

      // Join the Socket.IO room for the lobby
      socket.join(lobbyId);

      // Emit "lobbyCreated" event to the creator
      socket.emit('lobbyCreated', {
        lobbyId,
        players: lobbies[lobbyId].players,
        isCreator: true,
      });

      console.log(`Lobby created with ID: ${lobbyId} by ${username}`);
    });

    // Handle "joinLobby" event
    socket.on('joinLobby', ({ lobbyId, username }) => {
      const lobby = lobbies[lobbyId];
      if (lobby) {
        // Add the socket to the lobby
        lobby.players.push({ id: socket.id, name: username });
        socket.join(lobbyId);

        // Emit "lobbyUpdated" to all members
        io.to(lobbyId).emit('lobbyUpdated', {
          players: lobby.players,
        });

        console.log(`${username} (Socket: ${socket.id}) joined lobby: ${lobbyId}`);

        // Check if lobby is ready
        if (lobby.players.length >= MIN_PLAYERS && !lobby.hasStarted) {
          io.to(lobbyId).emit('lobbyReady', {
            players: lobby.players,
            isReady: true,
          });
          console.log(`Lobby ${lobbyId} is ready to start the game.`);
        }
      } else {
        // Lobby not found
        socket.emit('lobbyError', {
          message: 'Lobby not found',
        });
      }
    });

    // Handle "startGame" event
    socket.on('startGame', (lobbyId) => {
      const lobby = lobbies[lobbyId];
      if (lobby) {
        // Check if the emitter is the lobby creator
        if (socket.id !== lobby.creator) {
          socket.emit('lobbyError', {
            message: 'Only the lobby creator can start the game.',
          });
          return;
        }

        // Check if the lobby has enough players
        if (lobby.players.length < MIN_PLAYERS) {
          socket.emit('lobbyError', {
            message: `Cannot start game. Minimum ${MIN_PLAYERS} players required.`,
          });
          return;
        }

        // Prevent multiple game starts
        if (lobby.hasStarted) {
          socket.emit('lobbyError', {
            message: 'Game has already started.',
          });
          return;
        }

        // Emit "startChatroom" to all lobby members
        io.to(lobbyId).emit('startChatroom', {
          message: 'Game is starting!',
          lobbyId, // Include lobbyId for client-side routing
        });

        // Update lobby status
        lobby.hasStarted = true;

        console.log(`Game started for lobby: ${lobbyId}`);
      } else {
        // Lobby not found
        socket.emit('lobbyError', {
          message: 'Lobby not found',
        });
      }
    });

    // Handle client disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);

      // Iterate through lobbies to remove the disconnected socket
      for (const lobbyId in lobbies) {
        const lobby = lobbies[lobbyId];
        const playerIndex = lobby.players.findIndex((player) => player.id === socket.id);
        if (playerIndex !== -1) {
          const removedPlayer = lobby.players.splice(playerIndex, 1)[0];
          console.log(`${removedPlayer.name} (Socket: ${socket.id}) left lobby: ${lobbyId}`);

          // If the disconnected client was the creator, assign a new creator
          if (lobby.creator === socket.id) {
            if (lobby.players.length > 0) {
              lobby.creator = lobby.players[0].id;
              // Notify the new creator
              io.to(lobby.creator).emit('creatorAssigned', {
                message: 'You are now the lobby creator.',
              });
              console.log(`New creator for lobby ${lobbyId}: ${lobby.creator}`);
            } else {
              // No players left; delete the lobby
              delete lobbies[lobbyId];
              console.log(`Lobby ${lobbyId} deleted (no players).`);
              continue;
            }
          }

          // Notify remaining players about the update
          io.to(lobbyId).emit('lobbyUpdated', {
            players: lobby.players,
          });
        }
      }
    });
  });
};
