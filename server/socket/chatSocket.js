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
const votingService = require('../services/votingService');

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
      if (lobby.hasStarted) {
        const player = lobby.players.find((p) => p.socketId === socket.id);
        if (player && player.role) {
          // Re-send the role
          socket.emit('roleAssigned', {
            role: player.role,
            // Include anything else relevant to the player
          });
        }
      }
      socket.emit('playerUpdated', { player })
    });

    socket.on('requestRole', ({ lobbyId }) => {
      const lobby = lobbyService.getLobby(lobbyId);
      if (!lobby) {
        console.log(`requestRole: Lobby ${lobbyId} does not exist.`);
        return socket.emit('lobbyError', { message: 'Lobby does not exist.' });
      }

      const player = lobby.players.find((p) => p.socketId === socket.id);
      if (!player) {
        console.log(`requestRole: Player with socketId ${socket.id} not found in Lobby ${lobbyId}.`);
        return socket.emit('lobbyError', { message: 'You are not in this lobby.' });
      }

      if (player.role) {
        console.log(`requestRole: Assigning role ${player.role} to ${player.username}`);
        socket.emit('roleAssigned', { role: player.role });
      } else {
        console.log(`requestRole: Player ${player.username} does not have a role assigned yet.`);
        // Optionally, you could emit an error or a default role
        socket.emit('lobbyError', { message: 'Role not assigned yet.' });
      }
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
    
      // Retrieve the lobbyId that was stored on this socket
      const lobbyId = socket.lobbyId;
      if (!lobbyId) {
        // We don't know which lobby the user was in, so just return
        console.log('No lobbyId found for disconnecting socket.');
        return;
      }
    
      // Now fetch the lobby
      const lobby = lobbyService.getLobby(lobbyId);
      if (!lobby) {
        console.log('Lobby not found or already removed.');
        return;
      }
    
      // Find the player in that lobby who matches our socket
      let disconnectedPlayer = lobby.players.find((p) => p.socketId === socket.id);
      if (!disconnectedPlayer) {
        console.log('Could not find a matching player in the lobby.');
        return;
      }
    
      // Mark them dead, remove them, etc.
      disconnectedPlayer.isAlive = false;
    
      // Now broadcast (or update) to everyone in the lobby
      // If you want ALL connected clients to see it:
      io.to(lobbyId).emit('updateAllPlayers', { players: lobby.players });
    });
    

    socket.on('dayPhase', () => {
      const lobbyId = socket.lobbyId;
      const lobby = lobbyService.getLobby(lobbyId);
      for (let i = 0; i < lobby.players.length; i++) {
        if(lobby.players[i].vote != '') {
          votee = lobby.players.find((p) => p.socketId === lobby.players[i].vote);
          votee.voteCount++;
        }
      }
      let max = -1;
      let votedPlayer = null;
      for (let i = 0; i < lobby.players.length; i++) {
        if(lobby.players[i].voteCount > max){
          max = lobby.players[i].voteCount;
          votedPlayer = lobby.players[i];
        }
      }

      votedPlayer.isAlive = false;

      for (let i = 0; i < lobby.players.length; i++) {
        let player = lobby.players[i];
        player.vote = '';
        player.voteCount = 0;
      }

      socket.emit('updateAllPlayers', { players: lobby.players })
    });

    socket.on('nightPhase', () => {
      const lobbyId = socket.lobbyId;
      io.to(lobbyId).emit('startVoting', {});
    });

    socket.on('voteCast',({lobbyId, voteId}) => {
        votingService.castVote(socket.id, voteId);
        console.log(socket.Id, ' casted a vote for:', voteId);
    });

  });
}

module.exports = { initChatSocket };