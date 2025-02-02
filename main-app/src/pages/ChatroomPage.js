import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import socket from "../service/socket";
import VotingPopup from "../components/VotingPopup"; 
import "../styles/ChatroomPage.css";

const ChatroomPage = () => {
  const navigate = useNavigate();
  const { lobbyId } = useParams();

  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef(null);

  // Basic user info
  const [username, setUsername] = useState("");
  const [role, setRole] = useState(null);
  const [isEliminated, setIsEliminated] = useState(false);

  // Phase/time states
  const [currentPhase, setCurrentPhase] = useState("day");
  const [timeLeft, setTimeLeft] = useState(0);

  // Voting states
  const [isVoting, setIsVoting] = useState(false);
  const [voteType, setVoteType] = useState("villager");
  const [voteId, setVoteId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [isVoteLocked, setIsVoteLocked] = useState(false);

  const debugLog = (msg, data = null) => console.log(`[DEBUG] ${msg}`, data);

  // 1. Load username
  useEffect(() => {
    const stored = localStorage.getItem("username");
    if (stored) setUsername(stored);
    else navigate("/");
  }, [navigate]);

  // 2. Listen for roleAssigned
  useEffect(() => {
    const handleRoleAssigned = (data) => {
      debugLog("roleAssigned", data);
      setRole(data.role);
    };
    socket.on("roleAssigned", handleRoleAssigned);
    return () => {
      socket.off("roleAssigned", handleRoleAssigned);
    };
  }, []);

  // 3. Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 4. Listen for message
  useEffect(() => {
    const handleMessage = (m) => {
      debugLog("message", m);
      setMessages(prev => [...prev, m]);
    };
    socket.on("message", handleMessage);
    return () => {
      socket.off("message", handleMessage);
    };
  }, []);

  // 5. Join Chat
  useEffect(() => {
    if (!socket || !lobbyId || !username) return;
    debugLog("Joining chatroom...", { lobbyId, username });

    socket.emit("joinChatroom", { lobbyId, username }, (res) => {
      if (res?.error) {
        debugLog("joinChatroom error", res.error);
        alert(res.error);
        navigate("/");
      } else {
        debugLog("Joined chatroom, now requesting role...");
        socket.emit("requestRole", { lobbyId });
      }
    });

    return () => {
      debugLog("Leaving chatroom");
      socket.emit("leaveChatroom", { lobbyId, username });
    };
  }, [lobbyId, username, navigate]);

  // 6. Phase updates
  useEffect(() => {
    const handlePhaseUpdate = ({ phase, timeLeft }) => {
      debugLog("phaseUpdate", { phase, timeLeft });
      setCurrentPhase(phase);
      setTimeLeft(timeLeft);

      if (phase === "day" || phase === "night") {
        setIsVoting(false);
        setIsVoteLocked(false);
      }
    };
    socket.on("phaseUpdate", handlePhaseUpdate);
    return () => {
      socket.off("phaseUpdate", handlePhaseUpdate);
    };
  }, []);

  // 7. Start Voting
  const handleStartVoting = () => {
    setIsVoting(false);
    setIsVoteLocked(false);
    debugLog("StartVoting button clicked", { voteType, lobbyId });
    socket.emit("start_vote", { voteType, lobbyId });
  };

  // 8. open_voting / voting_complete
  useEffect(() => {
    const handleOpenVoting = ({ voteType: incType, voteId: incId, players: incPlayers }) => {
      debugLog("open_voting", { incType, incId, incPlayers });
      setVoteType(incType);
      setVoteId(incId);

      // remove yourself from the target list if you don't want self votes
      const filtered = incPlayers.filter(p => p !== username);
      setPlayers(filtered);

      if (incType === "mafia") {
        // only mafia sees the popup
        if (role && role.toLowerCase() === "mafia") {
          setIsVoting(true);
        } else {
          setIsVoteLocked(true);
        }
      } else {
        // villager => everyone can vote
        setIsVoting(true);
      }
    };

    const handleVotingComplete = ({ eliminated }) => {
      debugLog("voting_complete", { eliminated });
      setIsVoting(false);
      setIsVoteLocked(false);

      if (eliminated === username) {
        setIsEliminated(true);
      }
    };

    socket.on("open_voting", handleOpenVoting);
    socket.on("voting_complete", handleVotingComplete);
    return () => {
      socket.off("open_voting", handleOpenVoting);
      socket.off("voting_complete", handleVotingComplete);
    };
  }, [role, username]);

  // 9. chatDisabled logic
  const chatDisabled = isEliminated ||
    (voteType === "mafia" && isVoting && role?.toLowerCase() !== "mafia") ||
    isVoteLocked;

  // 10. handleSendMessage
  const handleSendMessage = () => {
    if (!message.trim() || chatDisabled) return;
    socket.emit("sendMessage", { lobbyId, text: message.trim() });
    setMessage("");
  };

  // 11. format time
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="chatroom-container">
      <div className="chatroom-header">
        <h2>Chatroom</h2>
        <button className="back-button" onClick={() => navigate("/")}>Back to Home</button>

        <div className="voting-controls">
          <select value={voteType} onChange={(e) => setVoteType(e.target.value)}>
            <option value="villager">Villager Vote</option>
            <option value="mafia">Mafia Kill</option>
          </select>
          <button
            onClick={handleStartVoting}
            disabled={currentPhase !== "voting" || isEliminated}
          >
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
        {messages.map((m, idx) => (
          <div key={idx} className="chatroom-message">
            <span className="chatroom-username">{m.sender}: </span>
            <span className="chatroom-text">{m.text}</span>
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
          disabled={chatDisabled}
        >
          Send
        </button>
      </div>

      {isVoting && (
        <VotingPopup
          players={players}
          onVote={(targetPlayer) => {
            debugLog(`Vote submitted for ${targetPlayer}`);
            socket.emit("submit_vote", {
              lobbyId,
              voteId,
              voter: username,
              target: targetPlayer,
            });
            // Immediately close popup => no duplicates
            setIsVoting(false);
          }}
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