// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

// Create an Express app and an HTTP server
const app = express();
const server = http.createServer(app);

// Attach Socket.IO to our HTTP server
const io = new Server(server, {
  cors: {
    origin: '*', // or ["http://localhost:3000"] if you want to restrict
  },
});

// We'll store all lobbies in memory for this demo
let lobbies = {};
const MIN_PLAYERS = 3;

// When a client connects via Socket.IO
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Handle "createLobby" event
  socket.on('createLobby', () => {
    const lobbyId = uuidv4(); // Generate a unique lobby ID
    lobbies[lobbyId] = {
      id: lobbyId,
      players: [socket.id],
    };

    // The socket joins the Socket.IO "room" for that lobby
    socket.join(lobbyId);

    // Send back to the creator the new lobby info
    socket.emit('lobbyCreated', {
      lobbyId,
      players: [socket.id],
    });

    console.log('Lobby created with ID:', lobbyId);
  });

  // Handle "joinLobby" event
  socket.on('joinLobby', (lobbyId) => {
    const lobby = lobbies[lobbyId];
    if (lobby) {
      // Add this socket's ID to the lobby's player list
      lobby.players.push(socket.id);

      // Join the same Socket.IO room
      socket.join(lobbyId);

      // Notify everyone in the room that a player joined
      io.to(lobbyId).emit('lobbyUpdated', {
        players: lobby.players,
      });

      console.log(`Socket ${socket.id} joined lobby: ${lobbyId}`);

      if (lobby.players.length >= MIN_PLAYERS) {
        console.log(`Lobby ${lobbyId} has enough players. Ready to start game.`);
        io.to(lobbyId).emit('startGame', { players: lobby.players });
      }
    } else {
      // If the lobby doesn't exist, notify the client
      socket.emit('lobbyError', {
        message: 'Lobby not found',
      });
    }
  });

  // Handle client disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    // Remove the socket from any lobby it was in
    for (const id in lobbies) {
      const lobby = lobbies[id];
      lobby.players = lobby.players.filter((p) => p !== socket.id);

      // If no players left, delete the lobby
      if (lobby.players.length === 0) {
        delete lobbies[id];
        console.log(`Lobby ${id} deleted (no players).`);
      } else {
        // Otherwise, notify the remaining players
        io.to(id).emit('lobbyUpdated', { players: lobby.players });
      }
    }
  });
});

// Start the server on port 4000
const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
