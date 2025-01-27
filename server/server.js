// server/server.js
/**
 * Entry point and core server setup
 * Responsibilities:
 * - Initialize Express/Socket.IO
 * - Attach controllers
 * - Manage middleware
 * - Handle server errors
 * - Coordinate cross-controller communication
 */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Import Controllers
const chatController = require('./controllers/chatController');
const lobbyController = require('./controllers/lobbyController');

// Initialize Express App
const app = express();

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*', // Adjust as needed for production
    methods: ['GET', 'POST'],
  },
});

// Attach Controllers to Socket.IO
chatController(io);  // For chatroom functionalities
lobbyController(io); // For lobby functionalities

// Start the Server
const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
