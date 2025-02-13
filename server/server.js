// server/server.js
/*
server/
server.js
Description:
This is the entry point for the backend server. It sets up the server, initializes WebSocket and HTTP handling, and establishes routes and middleware.
Key Responsibilities:
Configure the server (e.g., port, middleware).
Initialize socket.io for real-time communication.
Attach controllers and sockets to handle application logic.
*/

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Socket initializers
const { initLobbySocket } = require('./socket/lobbySocket');
const { initChatSocket } = require('./socket/chatSocket');
const { initVotingSocket } = require('./socket/votingSocket');

// (Optional) Express-based Controllers
const lobbyController = require('./controllers/lobbyController');
const chatController = require('./controllers/chatController');

// Initialize Express App
const app = express();
app.use(express.json());

// Mount your REST controllers here if you plan to keep them
// (These are optional if you're going pure websockets)
app.use('/api/lobby', lobbyController);
app.use('/api/chat', chatController);

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*', // For development; limit in production
    methods: ['GET', 'POST'],
  },
});

// Attach Socket Listeners
initLobbySocket(io);
initChatSocket(io);
initVotingSocket(io); 

// Start the Server
const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
