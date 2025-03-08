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
const { rewriteMessage } = require('../services/claudeService');

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

    // 3. sendMessage
    socket.on("sendMessage", async ({ lobbyId, text }) => {
      const lobby = lobbyService.getLobby(lobbyId);
      if (!lobby) {
        return socket.emit("lobbyError", { message: "Lobby not found." });
      }

      const player = lobby.players.find((p) => p.socketId === socket.id);
      if (!player) {
        return socket.emit("lobbyError", { message: "Player not in this lobby." });
      }

      // Check if the user is alive
      if (!player.isAlive) {
        // 3a. Dead => no rewrite, only visible to dead
        console.log(`[CHAT] Dead player ${player.username} => broadcast only to dead players (no AI rewrite).`);
        const deadMsgObj = {
          text,
          sender: player.username,
          timestamp: new Date(),
          isDead: true
        };

        // Send to all dead players (including sender)
        lobby.players.forEach((pl) => {
          if (!pl.isAlive) {
            io.to(pl.socketId).emit("message", deadMsgObj);
          }
        });
        return;
      }

      // 3b. If player is alive => check if they are Mafia or not
      const isMafia = player.role?.toLowerCase() === "mafia";
      let finalText = text;

      // Skip rewriting if Mafia; otherwise call Claude
      if (!isMafia) {
        try {
          finalText = await rewriteWithClaude(text);
        } catch (err) {
          console.error("[CHAT] Claude rewriting failed. Using original text:", err);
          finalText = text;
        }
      }

      const aliveMsgObj = {
        text: finalText,
        sender: player.username,
        timestamp: new Date(),
        isDead: false
      };

      // 3c. Distribute message to the correct group, based on phase & role
      const { phase } = lobby;

      if (phase === "day" || phase === "voting") {
        // All alive players see each other's messages
        lobby.players.forEach((pl) => {
          if (pl.isAlive) {
            io.to(pl.socketId).emit("message", aliveMsgObj);
          }
        });

      } else if (phase === "night") {
        // NIGHT
        if (isMafia) {
          // Mafia => broadcast among alive mafia members
          lobby.players.forEach((pl) => {
            if (pl.isAlive && pl.role?.toLowerCase() === "mafia") {
              io.to(pl.socketId).emit("message", aliveMsgObj);
            }
          });
        } else {
          // Non-mafia sees only their own message
          io.to(player.socketId).emit("message", aliveMsgObj);
        }
      }
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

// Helper function that calls your claudeService directly
async function rewriteWithClaude(originalText) {
  // We just reuse your rewriteMessage function from claudeService
  return await rewriteMessage(originalText);
}

module.exports = { initChatSocket };
