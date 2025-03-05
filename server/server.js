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

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors'; // Import CORS middleware

// Socket initializers
import { initLobbySocket } from './socket/lobbySocket.js';
import { initChatSocket } from './socket/chatSocket.js';
import { initVotingSocket } from './socket/votingSocket.js';

// (Optional) Express-based Controllers
import lobbyController from './controllers/lobbyController.js';
import chatController from './controllers/chatController.js';

// Import the new route for rewriting messages
import claudeServiceRoute from './routes/claudeServiceRoute.js'; // Import the route

// Initialize Express App
const app = express();
app.use(cors({
  origin: '*', // Allow all origins (modify for production security)
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'], // Customize headers allowed in requests
}));
app.use(express.json());

// Mount your REST controllers here if you plan to keep them
// (These are optional if you're going pure websockets)
app.use('/api/lobby', lobbyController);
app.use('/api/chat', chatController);
app.use('/api/claude', claudeServiceRoute); // Add this line for the Claude service

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
