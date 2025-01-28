import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import socket from "../service/socket";
import "../styles/ChatroomPage.css";

const ChatroomPage = () => {
  const navigate = useNavigate();
  const { lobbyId } = useParams();
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [username, setUsername] = useState("");
  const messagesEndRef = useRef(null);

  // 1. Retrieve username from localStorage
  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
    } else {
      // If no username was found in localStorage, redirect to home
      navigate("/");
    }
  }, [navigate]);

  // 2. Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 3. Handle incoming messages and socket events
  useEffect(() => {
    if (!socket) return;

    function handleMessage(newMessage) {
      setMessages((prev) => [...prev, newMessage]);
    }

    function handleLobbyError(err) {
      alert(err.message);
      navigate("/");
    }

    socket.on("message", handleMessage);
    socket.on("lobbyError", handleLobbyError);

    return () => {
      socket.off("message", handleMessage);
      socket.off("lobbyError", handleLobbyError);
    };
  }, [navigate]);

  // 4. Join the chatroom
  useEffect(() => {
    if (!socket || !lobbyId || !username) return;

    socket.emit("joinChatroom", { lobbyId, username });

    // If this component unmounts, leave the chatroom
    return () => {
      socket.emit("leaveChatroom", { lobbyId, username });
    };
  }, [lobbyId, username]);

  // 5. Handle sending a message
  const handleSendMessage = () => {
    if (message.trim()) {
      // We ONLY send lobbyId and text.
      // The server (chatSocket.js) will override "sender" and "timestamp"
      socket.emit("sendMessage", {
        lobbyId,
        text: message.trim(),
      });
      setMessage("");
    }
  };

  // 6. Handle "Enter" key press
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 7. Go back to home
  const handleBackToHome = () => {
    navigate("/");
  };

  return (
    <div className="chatroom-container">
      {/* Header */}
      <div className="chatroom-header">
        <h2>Chatroom</h2>
        <button className="back-button" onClick={handleBackToHome}>
          Back to Home
        </button>
      </div>

      {/* Messages Display */}
      <div className="chatroom-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className="chatroom-message">
            <span className="chatroom-timestamp">
              {new Date(msg.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>{" "}
            <span className="chatroom-username">{msg.sender}:</span>{" "}
            <span className="chatroom-text">{msg.text}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Container */}
      <div className="chatroom-input-container">
        <textarea
          className="chatroom-input"
          rows="2"
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
        />
        <button className="chatroom-send-button" onClick={handleSendMessage}>
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatroomPage;
