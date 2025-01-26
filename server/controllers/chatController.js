// server/controllers/chatController.js

module.exports = (io) => {
    io.on('connection', (socket) => {
      console.log('User connected to chatroom:', socket.id);
  
      // Handle "sendMessage" event
      socket.on('sendMessage', ({ lobbyId, text, sender }) => {
        const enrichedMessage = {
          text,             // The message text
          sender,           // The sender's username or ID
          timestamp: new Date(), // Optional: Add a timestamp
        };
        // Broadcast the message to all clients in the specified lobby
        io.to(lobbyId).emit('message', enrichedMessage);
        console.log(`Message from ${sender} in lobby ${lobbyId}: ${text}`);
      });

      socket.on("joinChatroom", ({ lobbyId, username }) => {
        socket.join(lobbyId);
        // optional system message
        socket.to(lobbyId).emit("message", {
          text: `${username} has joined the chat.`,
          sender: "System",
          timestamp: new Date(),
        });
      });      
  
      // Handle client disconnect
      socket.on('disconnect', () => {
        console.log('User disconnected from chatroom:', socket.id);
      });
    });
  };
  