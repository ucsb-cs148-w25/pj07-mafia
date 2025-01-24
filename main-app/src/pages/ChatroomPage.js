import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import "../styles/ChatroomPage.css";

const socket = io("http://localhost:3001");

const ChatroomPage = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Listen for incoming messages
    socket.on("message", (newMessage) => {
      // Add the message only if it is not already in the local messages array
      setMessages((prev) => {
        if (newMessage.sender === socket.id) return prev; // Avoid duplicate
        return [...prev, newMessage];
      });
    });

    return () => {
      socket.off("message");
    };
  }, []);

  const handleSendMessage = () => {
    if (message.trim()) {
      const messageData = {
        text: message,
        sender: socket.id, // Use the socket ID as the sender
      };
      setMessages((prev) => [...prev, messageData]); // Add the message locally
      socket.emit("sendMessage", { text: message }); // Send the message text to the server
      setMessage(""); // Clear the input box
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        setMessage((prev) => prev + "\n"); // Add newline on Shift + Enter
      } else {
        e.preventDefault(); // Prevent new line in the input field
        handleSendMessage();
      }
    }
  };

  const handleBackToHome = () => {
    navigate("/");
  };

  return (
    <div className="chatroom-container">
      <div className="chatroom-header">
        Chatroom
        <button className="back-button" onClick={handleBackToHome}>
          Back to Home
        </button>
      </div>
      <div className="chatroom-messages">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`chatroom-message ${
              msg.sender === socket.id ? "me" : "other"
            }`}
          >
            {msg.sender !== socket.id && (
              <span className="sender-label">{msg.sender}</span>
            )}
            {msg.text}
          </div>
        ))}
      </div>
      <div className="chatroom-input-container">
        <textarea
          rows="5"
          className="chatroom-input"
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
        />
        <button className="chatroom-send-button" onClick={handleSendMessage}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChatroomPage;
