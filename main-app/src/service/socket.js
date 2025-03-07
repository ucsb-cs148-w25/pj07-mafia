// main-app/src/services/socket.js
import { io } from "socket.io-client";
import config from "../config";

const socket = io(config.backendUrl, {
  autoConnect: true,
  withCredentials: true,
  transports: ["websocket"] // Force WebSocket transport
});

// Add connection logging
socket.on("connect_error", (err) => {
  console.log("Connection error:", err.message);
});

export default socket;
