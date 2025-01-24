const http = require("http");
const socketIo = require("socket.io");

const server = http.createServer();
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow any origin for development
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("sendMessage", (messageData) => {
    const enrichedMessage = {
      text: messageData.text, // The message text
      sender: socket.id, // The sender's unique ID
    };
    // console.log("Broadcasting message:", enrichedMessage); // Debug log
    io.emit("message", enrichedMessage); // Broadcast the enriched message to all clients
  });
  

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});


server.listen(3001, () => {
  console.log("Chatroom server listening on port 3001");
});
