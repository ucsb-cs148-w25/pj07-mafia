// server/server.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Socket initializers
const { initLobbySocket } = require('./socket/lobbySocket');
const { initChatSocket } = require('./socket/chatSocket');

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

// Start the Server
const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
