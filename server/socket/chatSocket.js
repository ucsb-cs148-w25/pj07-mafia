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
        if (ack) ack({ error: "Lobby does not exist." });
        return socket.emit("lobbyError", { message: "Lobby does not exist." });
      }
    
      const player = lobby.players.find((p) => p.socketId === socket.id);
      if (!player) {
        if (ack) ack({ error: "You are not in this lobby." });
        return socket.emit("lobbyError", { message: "You are not in this lobby." });
      }
    
      console.log(`joinChatroom: Player ${player.username} joined chat in Lobby ${lobbyId}.`);
    
      // <--- ADD THIS: Return the current list of all players in this chat/lobby
      if (ack) {
        ack({
          success: true,
          players: lobby.players.map((p) => p.username), 
        });
      }
    
      socket.to(lobbyId).emit("message", {
        text: `${player.username} has joined the chat.`,
        sender: "System",
        timestamp: new Date(),
      });
    
      // If the game has started and the player already has a role
      if (lobby.hasStarted && player.role) {
        socket.emit("roleAssigned", { role: player.role });
      }
    
      // If the player is detective, also join the detective room
      if (player.role && player.role.toLowerCase() === "detective") {
        socket.join(`${lobbyId}_detectives`);
        console.log(
          `Detective ${player.username} joined room ${lobbyId}_detectives for private messages.`
        );
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

    // 3. Normal living player message
    socket.on("sendMessage", async ({ lobbyId, text, senderName }) => {
      const lobby = lobbyService.getLobby(lobbyId);
      if (!lobby) {
        return socket.emit("lobbyError", { message: "Lobby not found." });
      }

      // If the client passes 'senderName', we can rely on it. 
      // Or we can figure it out from the socket. You choose:
      let player = lobby.players.find((p) => p.socketId === socket.id);
      if (!player) {
        return socket.emit("lobbyError", { message: "Player not in this lobby." });
      }

      // If the player is dead, do not let them post in main chat
      if (!player.isAlive) {
        console.log(`[CHAT] Dead player ${player.username} tried main chat. Ignored.`);
        return;
      }

      // Possibly rewrite if not mafia
      let finalText = text;
      const isMafia = (player.role || "").toLowerCase() === "mafia";
      if (!isMafia) {
        try {
          finalText = await rewriteMessage(text);
        } catch (err) {
          console.error("[CHAT] rewrite failed. fallback to original:", err);
        }
      }

      const msgObj = {
        text: finalText,
        sender: senderName || player.username,
        timestamp: new Date(),
        isGhost: false,
      };

      // Distribute based on day/night
      const { phase } = lobby;
      if (phase === "day" || phase === "voting") {
        // all alive
        lobby.players.forEach((pl) => {
          if (pl.isAlive) {
            io.to(pl.socketId).emit("message", msgObj);
          }
        });
      } else if (phase === "night") {
        // mafia only sees mafia, non-mafia sees self
        if (isMafia) {
          lobby.players.forEach((pl) => {
            if (pl.isAlive && (pl.role || "").toLowerCase() === "mafia") {
              io.to(pl.socketId).emit("message", msgObj);
            }
          });
        } else {
          // only the sender sees their own text
          io.to(player.socketId).emit("message", msgObj);
        }
      }
    });

    // 4. Ghost message from a dead player
    socket.on("sendGhostMessage", ({ lobbyId, text }) => {
      const lobby = lobbyService.getLobby(lobbyId);
      if (!lobby) {
        return socket.emit("lobbyError", { message: "Lobby not found." });
      }

      const player = lobby.players.find((p) => p.socketId === socket.id);
      if (!player) {
        return socket.emit("lobbyError", { message: "Player not in this lobby." });
      }

      if (player.isAlive) {
        console.log(`[GHOST] Alive player ${player.username} tried ghost chat. Denied.`);
        return;
      }

      // broadcast only to dead
      const msgObj = {
        text,
        sender: `Ghost_${player.username}`,
        timestamp: new Date(),
        isGhost: true,
      };
      lobby.players.forEach((pl) => {
        if (!pl.isAlive) {
          io.to(pl.socketId).emit("message", msgObj);
        }
      });
      console.log(`[GHOST CHAT] ${player.username} => all dead: ${text}`);
    });

    // 5. AI message continuing the player's "alive" persona
    socket.on("sendAiMessage", ({ lobbyId, text, eliminatedPlayerName }) => {
      const lobby = lobbyService.getLobby(lobbyId);
      if (!lobby) {
        return socket.emit("lobbyError", { message: "Lobby not found." });
      }

      // Force broadcast as if this user were alive
      const msgObj = {
        text,
        sender: eliminatedPlayerName,
        timestamp: new Date(),
        isGhost: false,
        isAi: true,
      };
      io.to(lobbyId).emit("message", msgObj);
      console.log(`[AI MESSAGE] from ${eliminatedPlayerName}: ${text}`);
    });

    // 4. leaveChatroom
    socket.on("leaveChatroom", ({ lobbyId, username }) => {
      socket.leave(lobbyId);
    
      const lobby = lobbyService.getLobby(lobbyId);
      if (lobby) {
        // Remove them from the local lobby players list if you want them gone from the entire game
        const idx = lobby.players.findIndex((p) => p.socketId === socket.id);
        if (idx !== -1) {
          lobby.players.splice(idx, 1);
        }
    
        // Broadcast an updated player list
        io.to(lobbyId).emit("chatroomUpdated", {
          players: lobby.players.map((p) => p.username),
        });
    
        socket.to(lobbyId).emit("message", {
          text: `${username} has left the chat.`,
          sender: "System",
          timestamp: new Date(),
        });
    
        console.log(`${username} removed from chat of Lobby ${lobbyId}.`);
      }
    });
    

    // 5. disconnect
    socket.on('disconnect', () => {
      console.log('User disconnected from chatroom:', socket.id);
    });
  });
}

module.exports = { initChatSocket };