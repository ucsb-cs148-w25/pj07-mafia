// server/socket/chatSocket.js
/*
chatSocket.js
Description:
Manages WebSocket events for the chat system.
Key Responsibilities:
Handle user connection to chatrooms.
Broadcast messages to all users in a chatroom.
Notify when users join or leave the chat.
*/
const lobbyService = require('../services/lobbyService');

function initChatSocket(io) {
  io.on('connection', (socket) => {
    console.log('User connected to chatroom:', socket.id);

    // 1. joinChatroom
    socket.on("joinChatroom", ({ lobbyId, username }, ack) => {
      socket.join(lobbyId);

      const lobby = lobbyService.getLobby(lobbyId);
      if (!lobby) {
        console.log(`joinChatroom: Lobby ${lobbyId} does NOT exist.`);
        if (ack) ack({ error: "Lobby does not exist." });
        return socket.emit("lobbyError", { message: "Lobby does not exist." });
      }

      const player = lobby.players.find((p) => p.socketId === socket.id);
      if (!player) {
        console.log(`joinChatroom: Player with socketId ${socket.id} not found in Lobby ${lobbyId}.`);
        if (ack) ack({ error: "You are not in this lobby." });
        return socket.emit("lobbyError", { message: "You are not in this lobby." });
      }

      console.log(`joinChatroom: Player ${player.username} joined chat in Lobby ${lobbyId}.`);

      if (ack) ack({ success: true });

      socket.to(lobbyId).emit("message", {
        text: `${player.username} has joined the chat.`,
        sender: "System",
        timestamp: new Date(),
      });

      if (lobby.hasStarted && player.role) {
        socket.emit("roleAssigned", { role: player.role });
      }
    });

    // 2. requestRole
    socket.on('requestRole', ({ lobbyId }) => {
      const lobby = lobbyService.getLobby(lobbyId);
      if (!lobby) {
        return socket.emit('lobbyError', { message: 'Lobby does not exist.' });
      }

      const player = lobby.players.find((p) => p.socketId === socket.id);
      if (!player) {
        return socket.emit('lobbyError', { message: 'You are not in this lobby.' });
      }

      if (player.role) {
        socket.emit('roleAssigned', { role: player.role });
      } else {
        socket.emit('lobbyError', { message: 'Role not assigned yet.' });
      }
    });

    // 3. sendMessage => skip if not alive
    socket.on('sendMessage', ({ lobbyId, text }) => {
      const lobby = lobbyService.getLobby(lobbyId);
      if (!lobby) {
        return socket.emit('lobbyError', { message: 'Lobby does not exist.' });
      }

      const player = lobby.players.find((p) => p.socketId === socket.id);
      if (!player) {
        return socket.emit('lobbyError', { message: 'You are not in this lobby.' });
      }

      if (!player.isAlive) {
        console.log(`[DEBUG] ${player.username} tried to chat but is eliminated.`);
        return; 
      }

      const msgObj = {
        text,
        sender: player.username,
        timestamp: new Date(),
      };

      io.to(lobbyId).emit('message', msgObj);
      console.log(`Message from ${player.username} in lobby ${lobbyId}: ${text}`);
    });

    // 4. leaveChatroom
    socket.on('leaveChatroom', ({ lobbyId, username }) => {
      socket.leave(lobbyId);

      socket.to(lobbyId).emit('message', {
        text: `${username} has left the chat.`,
        sender: 'System',
        timestamp: new Date(),
      });
    });

    // 5. disconnect
    socket.on('disconnect', () => {
      console.log('User disconnected from chatroom:', socket.id);
    });
  });
}

module.exports = { initChatSocket };