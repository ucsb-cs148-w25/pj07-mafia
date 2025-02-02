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

  // Role-related
  const [role, setRole] = useState(null);

  // Phase/time tracking
  const [currentPhase, setCurrentPhase] = useState(""); 
  const [timeLeft, setTimeLeft] = useState(0);

  // Debugging logger
  const debugLog = (message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`, data);
  };

  // 1. Load username, watch socket status
  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
      debugLog("Username loaded from storage:", storedUsername);
    } else {
      navigate("/");
    }
  }, [navigate]);

  // 2. Handle role assignment
  useEffect(() => {
    const handleRoleAssignment = (data) => {
      debugLog("ROLE ASSIGNMENT RECEIVED", data);
      setRole(data.role);
    };
    socket.on("roleAssigned", handleRoleAssignment);

    return () => {
      socket.off("roleAssigned", handleRoleAssignment);
    };
  }, []);

  // 3. Messages: autoscroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 4. Handle incoming chat messages
  useEffect(() => {
    const handleMessage = (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
      debugLog("New message received", newMessage);
    };
    const handleLobbyError = (err) => {
      debugLog("Lobby error", err.message);
      alert(err.message);
      navigate("/");
    };

    socket.on("message", handleMessage);
    socket.on("lobbyError", handleLobbyError);

    return () => {
      socket.off("message", handleMessage);
      socket.off("lobbyError", handleLobbyError);
    };
  }, [navigate]);

  // 5. Join chatroom once we have the username/lobbyId
  useEffect(() => {
    if (!socket || !lobbyId || !username) return;

    debugLog("Attempting to join chatroom", { lobbyId, username });

    const joinTimeout = setTimeout(() => {
      if (!socket.connected) {
        debugLog("Join timeout - socket not connected");
        alert("Connection timeout. Please refresh.");
      }
    }, 5000);

    socket.emit("joinChatroom", { lobbyId, username }, (response) => {
      clearTimeout(joinTimeout);
      if (response?.error) {
        debugLog("Join error", response.error);
        alert(response.error);
      } else {
        // After joining, request role
        debugLog("Joined chatroom. Requesting role...");
        socket.emit("requestRole", { lobbyId });
      }
    });

    return () => {
      debugLog("Leaving chatroom");
      socket.emit("leaveChatroom", { lobbyId, username });
    };
  }, [lobbyId, username]);

  // 6. NEW: Listen for "phaseUpdate"
  useEffect(() => {
    const handlePhaseUpdate = (data) => {
      debugLog("PHASE UPDATE received", data);
      setCurrentPhase(data.phase);
      setTimeLeft(data.timeLeft);
    };

    socket.on("phaseUpdate", handlePhaseUpdate);

    return () => {
      socket.off("phaseUpdate", handlePhaseUpdate);
    };
  }, []);

  // Utility: Format time (mm:ss)
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // 7. Sending a message
  const handleSendMessage = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage) {
      setMessage("");
      socket.emit(
        "sendMessage",
        { lobbyId, text: trimmedMessage },
        (ack) => {
          if (ack?.error) {
            debugLog("Message delivery failed", ack.error);
          } else {
            debugLog("Message delivered successfully");
          }
        }
      );
    }
  };

  return (
    <div className="chatroom-container">
      <div className="chatroom-header">
        <h2>Chatroom</h2>
        <button
          className="back-button"
          onClick={() => navigate("/")}
        >
          Back to Home
        </button>
      </div>

      {/* Show day/night phase & timer */}
      <div className="phase-timer">
        <strong>Phase:</strong> {currentPhase.toUpperCase()} |{" "}
        <strong>Time Left:</strong> {formatTime(timeLeft)}
      </div>

      {role && (
        <div
          className={`role-banner ${
            role.toLowerCase() === "mafia" ? "mafia" : ""
          }`}
        >
          Your Role: <span className="role-name">{role}</span>
        </div>
      )}

      <div className="chatroom-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className="chatroom-message">
            <span className="chatroom-timestamp">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
            <span className="chatroom-username"> {msg.sender}: </span>
            <span className="chatroom-text">{msg.text}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chatroom-input-container">
        <textarea
          className="chatroom-input"
          rows="2"
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
        />
        <button
          className="chatroom-send-button"
          onClick={handleSendMessage}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatroomPage;
