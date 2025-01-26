// main-app/src/components/ChatroomPage.js

import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
// Import the shared socket from services/
import socket from "../service/socket";
import "../styles/ChatroomPage.css";

const ChatroomPage = () => {
  const navigate = useNavigate();
  const { lobbyId } = useParams();
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [username, setUsername] = useState("");
  const messagesEndRef = useRef(null);

  // Retrieve username from localStorage
  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
    } else {
      navigate("/");
    }
  }, [navigate]);

  // Scroll to the latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Listen for incoming messages and handle events
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (newMessage) => {
      // Filter out system messages
      if (newMessage.sender === "System") return;

      setMessages((prev) => [...prev, newMessage]);
    };

    const handleLobbyError = (err) => {
      alert(err.message);
      navigate("/");
    };

    socket.on("message", handleMessage);
    socket.on("lobbyError", handleLobbyError);

    // Cleanup event listeners on unmount
    return () => {
      socket.off("message", handleMessage);
      socket.off("lobbyError", handleLobbyError);
    };
  }, [navigate]);

  // Join the chatroom
  useEffect(() => {
    if (!socket || !lobbyId || !username) return;

    socket.emit("joinChatroom", { lobbyId, username });

    // Optionally, handle acknowledgment or initial data
    // For example:
    // socket.on("joined", (data) => { ... });

    // Cleanup if needed
    return () => {
      socket.emit("leaveChatroom", { lobbyId, username });
    };
  }, [socket, lobbyId, username]);

  // Send message logic
  const handleSendMessage = () => {
    if (message.trim()) {
      const messageData = {
        lobbyId,
        text: message.trim(),
        sender: username,
        timestamp: new Date().toISOString(),
      };

      // Emit to server
      socket.emit("sendMessage", messageData);
      setMessage("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleBackToHome = () => {
    navigate("/");
  };

  // Basic UI layout
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2>Chatroom</h2>
        <button style={styles.backButton} onClick={handleBackToHome}>
          Back to Home
        </button>
      </div>

      {/* Messages Display */}
      <div style={styles.messagesContainer}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              ...styles.messageBubble,
              alignSelf: msg.sender === username ? "flex-end" : "flex-start",
              backgroundColor: msg.sender === username ? "#d1e7dd" : "#fff",
            }}
          >
            {msg.sender !== username && (
              <strong style={styles.senderName}>{msg.sender}</strong>
            )}
            <span>{msg.text}</span>
            <div style={styles.timestamp}>
              {new Date(msg.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div style={styles.inputContainer}>
        <textarea
          rows="3"
          style={styles.textarea}
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
        />
        <button style={styles.sendButton} onClick={handleSendMessage}>
          Send
        </button>
      </div>
    </div>
  );
};

// Styles object for inline styling
const styles = {
  container: {
    padding: "20px",
    maxWidth: "800px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  backButton: {
    padding: "8px 16px",
    borderRadius: "4px",
    border: "none",
    backgroundColor: "#6c757d",
    color: "#fff",
    cursor: "pointer",
  },
  messagesContainer: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    border: "1px solid #ccc",
    borderRadius: "8px",
    padding: "10px",
    overflowY: "auto",
    backgroundColor: "#f9f9f9",
  },
  messageBubble: {
    maxWidth: "60%",
    marginBottom: "10px",
    padding: "10px",
    borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    position: "relative",
  },
  senderName: {
    display: "block",
    marginBottom: "5px",
    color: "#333",
  },
  timestamp: {
    fontSize: "0.75rem",
    color: "#666",
    position: "absolute",
    bottom: "4px",
    right: "8px",
  },
  inputContainer: {
    display: "flex",
    marginTop: "20px",
  },
  textarea: {
    flexGrow: 1,
    padding: "10px",
    borderRadius: "4px",
    border: "1px solid #ccc",
    resize: "none",
    marginRight: "10px",
    fontSize: "1rem",
  },
  sendButton: {
    padding: "10px 20px",
    borderRadius: "4px",
    border: "none",
    backgroundColor: "#007bff",
    color: "#fff",
    cursor: "pointer",
    fontSize: "1rem",
  },
};

export default ChatroomPage;
