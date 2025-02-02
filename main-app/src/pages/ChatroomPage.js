import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import socket from "../service/socket";
import VotingPopup from "../components/VotingPopup"; // Import Voting Popup
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

  // Voting states
  const [players, setPlayers] = useState([]); 
  const [isVoting, setIsVoting] = useState(false);
  const [voteType, setVoteType] = useState("villager"); // "villager" or "mafia"
  const [voteId, setVoteId] = useState(null);
  const [isVoteLocked, setIsVoteLocked] = useState(false);
  const [isEliminated, setIsEliminated] = useState(false);

  // Debugging logger
  const debugLog = (message, data = null) => {
    console.log(`[DEBUG] ${message}`, data);
  };

  // Load username
  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
    } else {
      navigate("/");
    }
  }, [navigate]);

  // Handle role assignment
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

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle incoming messages
  useEffect(() => {
    const handleMessage = (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
      debugLog("New message received", newMessage);
    };

    socket.on("message", handleMessage);

    return () => {
      socket.off("message", handleMessage);
    };
  }, []);

  // Join chatroom
  useEffect(() => {
    if (!socket || !lobbyId || !username) return;

    debugLog("Joining chatroom...", { lobbyId, username });

    socket.emit("joinChatroom", { lobbyId, username }, (response) => {
      if (response?.error) {
        debugLog("Join error", response.error);
        alert(response.error);
      } else {
        debugLog("Joined chatroom. Requesting role...");
        socket.emit("requestRole", { lobbyId });
      }
    });

    return () => {
      debugLog("Leaving chatroom");
      socket.emit("leaveChatroom", { lobbyId, username });
    };
  }, [lobbyId, username]);

  // Listen for phase updates
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

  // Send message
  const handleSendMessage = () => {
    if (!message.trim() || isVoteLocked || isEliminated) return;

    socket.emit("sendMessage", { lobbyId, text: message.trim() });
    setMessage("");
  };

  // Format time
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="chatroom-container">
      <div className="chatroom-header">
        <h2>Chatroom</h2>
        <button className="back-button" onClick={() => navigate("/")}>
          Back to Home
        </button>

        <div className="voting-controls">
          <select value={voteType} onChange={(e) => setVoteType(e.target.value)}>
            <option value="villager">Villager Vote</option>
            <option value="mafia">Mafia Kill</option>
          </select>
          <button onClick={() => socket.emit("start_vote", { voteType, lobbyId })}>
            Start Voting
          </button>
        </div>
      </div>

      <div className="phase-timer">
        <strong>Phase:</strong> {currentPhase.toUpperCase()} |{" "}
        <strong>Time Left:</strong> {formatTime(timeLeft)}
      </div>

      {role && (
        <div className={`role-banner ${role.toLowerCase() === "mafia" ? "mafia" : ""}`}>
          Your Role: <span className="role-name">{role}</span>
        </div>
      )}

      <div className="chatroom-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className="chatroom-message">
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
        <button className="chatroom-send-button" onClick={handleSendMessage}>
          Send
        </button>
      </div>

      {isVoting && (
        <VotingPopup
          players={players}
          onVote={(player) => socket.emit("submit_vote", { lobbyId, voteId, voter: username, target: player })}
          onClose={() => setIsVoting(false)}
          role={voteType === "mafia" ? "Mafia" : "Villager"}
          username={username}
          lobbyId={lobbyId}
        />
      )}
    </div>
  );
};

export default ChatroomPage;
