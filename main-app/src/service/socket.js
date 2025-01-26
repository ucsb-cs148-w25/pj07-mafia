// main-app/src/services/socket.js
import { io } from "socket.io-client";

// Create and export a single Socket.IO connection
const socket = io("http://localhost:4000", {
  // You can configure transports, reconnection, etc. here if needed
});

export default socket;
