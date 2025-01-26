// main-app/src/components/ChatroomPage.js

import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
// Import the shared socket from services/
import socket from "../service/socket";

const ChatroomPage = () => {
  const navigate = useNavigate();
  const { lobbyId } = useParams();
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [username, setUsername] = useState("");

  // Retrieve username from localStorage
  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
    } else {
      navigate("/");
    }
  }, [navigate]);

  // Listen for incoming messages (and other events) once
  useEffect(() => {
    if (!socket) return;

    socket.on("message", (newMessage) => {
      // If ignoring your own broadcast, you can check: if (newMessage.sender === username) return;
      setMessages((prev) => [...prev, newMessage]);
    });

    socket.on("lobbyError", (err) => {
      alert(err.message);
      navigate("/");
    });

    // Cleanup event listeners on unmount
    return () => {
      socket.off("message");
      socket.off("lobbyError");
    };
  }, [socket, navigate]);

  // Rejoin the chatroom if needed
  useEffect(() => {
    if (!socket || !lobbyId || !username) return;

    socket.emit("joinChatroom", { lobbyId, username });
  }, [socket, lobbyId, username]);

  // Send message logic
  const handleSendMessage = () => {
    if (message.trim()) {
      const messageData = {
        lobbyId,
        text: message,
        sender: username,
      };
      // Local optimistic append
      setMessages((prev) => [...prev, messageData]);
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
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>Chatroom</h2>
        <button onClick={handleBackToHome}>Back to Home</button>
      </div>
      <div style={{
        border: '1px solid #ccc',
        borderRadius: '8px',
        height: '500px',
        overflowY: 'scroll',
        padding: '10px',
        backgroundColor: '#f9f9f9'
      }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: '10px', padding: '10px', borderRadius: '8px' }}>
            {msg.sender !== username && (
              <strong style={{ display: 'block', marginBottom: '5px' }}>
                {msg.sender}
              </strong>
            )}
            <span>{msg.text}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', marginTop: '20px' }}>
        <textarea
          rows="3"
          style={{
            flexGrow: 1,
            padding: '10px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            resize: 'none',
            marginRight: '10px'
          }}
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
        />
        <button
          style={{
            padding: '10px 20px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#007bff',
            color: '#fff',
            cursor: 'pointer'
          }}
          onClick={handleSendMessage}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatroomPage;
