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

    /**
     * Join Chatroom
     * The client calls: socket.emit("joinChatroom", { lobbyId, username });
     * We do keep track of them in the same room as the lobby, but for chat.
     */
    socket.on('joinChatroom', ({ lobbyId, username }) => {
      // The server can still store them in the same "room"
      // (They should already be in that room from the lobbySocket, but this is optional.)
      socket.join(lobbyId);

      // For debugging: Check if we actually have a valid lobby
      const lobby = lobbyService.getLobby(lobbyId);
      if (!lobby) {
        console.log(`joinChatroom: Lobby ${lobbyId} does NOT exist.`);
        return socket.emit('lobbyError', { message: 'Lobby does not exist.' });
      }

      // Check if the player is in that lobby
      const player = lobby.players.find((p) => p.socketId === socket.id);
      if (!player) {
        console.log(`joinChatroom: Player with socketId ${socket.id} not found in Lobby ${lobbyId}.`);
        // This might happen if the user never joined the lobby or there's a mismatch
        return socket.emit('lobbyError', { message: 'You are not in this lobby.' });
      }

      // Log who is actually joining
      console.log(`joinChatroom: Player ${player.username} (Socket: ${socket.id}) joined chat in Lobby ${lobbyId}.`);

      // Optionally broadcast that a user joined
      socket.to(lobbyId).emit('message', {
        text: `${player.username} has joined the chat.`,
        sender: 'System',
        timestamp: new Date(),
      });
    });

    /**
     * Send Message
     * The client calls: socket.emit("sendMessage", { lobbyId, text });
     * (We ignore or override any "sender" the client might pass.)
     */
    socket.on('sendMessage', ({ lobbyId, text }) => {
      // Use the server's data to figure out who is sending.
      const lobby = lobbyService.getLobby(lobbyId);
      if (!lobby) {
        // If the lobby doesn't exist, optionally handle an error
        socket.emit('lobbyError', { message: 'Lobby does not exist.' });
        return;
      }

      // Find the player in the lobby with this socket.id
      const player = lobby.players.find((p) => p.socketId === socket.id);
      if (!player) {
        // The user isn't recognized in this lobby
        socket.emit('lobbyError', { message: 'You are not in this lobby.' });
        return;
      }

      // Get the actual username from the server-side record
      const actualUsername = player.username;

      // Construct the final message object
      const messageObj = {
        text,
        sender: actualUsername,    // override client-provided "sender"
        timestamp: new Date(),
      };

      // Broadcast to everyone in the same lobby
      io.to(lobbyId).emit('message', messageObj);
      console.log(`Message from ${actualUsername} in lobby ${lobbyId}: ${text}`);
    });

    // socket.on('nightTime', ({ lobbyId }) => {
    //   console.log(`Night time event triggered for lobby ${lobbyId}`);

    //   socket.to(lobbyId).emit('message', {
    //     text: `It is night time!`,
    //     sender: 'System',
    //     timestamp: new Date(),
    //   });
    // });

    // socket.on('dayTime', ({ lobbyId }) => {
    //   console.log(`Day time event triggered for lobby ${lobbyId}`);

    //   socket.to(lobbyId).emit('message', {
    //     text: `It is day time!`,
    //     sender: 'System',
    //     timestamp: new Date(),
    //   });
    // });

    // const lobbyState = {}; // Store which lobbies have already triggered nightTime

    socket.on('nightTime', ({ lobbyId, isCreator }) => {
      console.log(`Night time event triggered for lobby ${lobbyId}`);
      // console.log(isCreator);

      // Ensure night mode is only triggered ONCE per lobby
      // lobbyState[lobbyId] = true; // Mark this lobby as handled 
      if (isCreator) {
        io.to(lobbyId).emit('message', {
          text: `It is night time!`,
          sender: 'System',
          timestamp: new Date(),
        });
      }
    });

    socket.on('dayTime', ({ lobbyId, isCreator }) => {
      console.log(`Day time event triggered for lobby ${lobbyId}`);
      // console.log(isCreator);

      // Ensure night mode is only triggered ONCE per lobby
      // lobbyState[lobbyId] = true; // Mark this lobby as handled 

      if (isCreator) {
        io.to(lobbyId).emit('message', {
          text: `It is day time!`,
          sender: 'System',
          timestamp: new Date(),
        });
      }
    });
    /**
     * Optional: Leave Chatroom
     * If your front end emits "leaveChatroom" when the user navigates away or closes,
     * you can handle it here. Typically, the "disconnect" event might suffice.
     */
    socket.on('leaveChatroom', ({ lobbyId, username }) => {
      socket.leave(lobbyId);

      // Optionally broadcast that the user left
      socket.to(lobbyId).emit('message', {
        text: `${username} has left the chat.`,
        sender: 'System',
        timestamp: new Date(),
      });
    });

    /**
     * Disconnect
     * The user might also have left the chat/lobby, so we can handle that
     * in the LOBBY or GAME logic (like removing them). But just log here.
     */
    socket.on('disconnect', () => {
      console.log('User disconnected from chatroom:', socket.id);
    });

    /**
     * Night time
     * The timer reaches 0. 
     */
    

  });

}

module.exports = { initChatSocket };