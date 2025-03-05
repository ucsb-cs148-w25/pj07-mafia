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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isFullRuleDropdownOpen, setIsFullRuleDropdownOpen] = useState(false);

  // Basic user info
  const [username, setUsername] = useState("");
  const [role, setRole] = useState(null);
  const [isEliminated, setIsEliminated] = useState(false);

  // Phase/time states
  const [currentPhase, setCurrentPhase] = useState("day");
  const [timeLeft, setTimeLeft] = useState(0);
  const [votingInitiated, setVotingInitiated] = useState(false);

  // Voting states
  const currentUsernameRef = useRef(sessionStorage.getItem("username"));
  const [isVoting, setIsVoting] = useState(false);
  const [voteType, setVoteType] = useState("villager");
  const [voteId, setVoteId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [isVoteLocked, setIsVoteLocked] = useState(false);
  const [showEliminationMessage, setShowEliminationMessage] = useState(false);

  const debugLog = (msg, data = null) => console.log(`[DEBUG] ${msg}`, data);

  // 1. Load username
  useEffect(() => {
    const stored = sessionStorage.getItem("username");
    if (stored) setUsername(stored);
    else navigate("/");
  }, [navigate]);
  // Sync currentUsernameRef with the username state
  useEffect(() => {
    if (username) {
      currentUsernameRef.current = username;
    }
  }, [username]);
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
    };
    socket.on("phaseUpdate", handlePhaseUpdate);
    return () => {
      socket.off("phaseUpdate", handlePhaseUpdate);
    };
  }, []);

  // 7. automated voting popup
  useEffect(() => {
    if (isEliminated) {
      console.log(`[CHATROOM] this user is eliminated`)
      return;
    }
    // Check if the current phase qualifies for auto vote initiation
    if ((currentPhase === "night" || currentPhase === "voting")) {
        console.log("[DEBUG] inside the phase validator", {votingInitiated})
        const voteTypeToEmit =
            currentPhase === "voting" ? "villager" : "mafia";
        console.log("[DEBUG] Auto initiating voting", { voteType: voteTypeToEmit, lobbyId, role});
        socket.emit("start_vote", { voteType: voteTypeToEmit, lobbyId });
    }
  }, [currentPhase, role, lobbyId, isEliminated, votingInitiated]);

  // 8. open_voting / voting_complete
  useEffect(() => {
    const handleOpenVoting = ({ voteType: incType, voteId: incId, players: incPlayers }) => {
      debugLog("open_voting", { incType, incId, incPlayers });
      setVoteType(incType);
      setVoteId(incId);

      // remove yourself from the target list if you don't want self votes
      const filtered = incPlayers.filter(
        (playerUsername) =>
          playerUsername.trim().toLowerCase() !== username.trim().toLowerCase()
      );
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
      debugLog("voting_complete", { eliminated, username});
      setIsVoting(false);
      setIsVoteLocked(false);
      if (eliminated){
        if (eliminated.trim().toLowerCase() === username.trim().toLowerCase()) {
          setIsEliminated(true);
          console.log("[DEBUG] Set IsEliminated to True")
          setShowEliminationMessage(true);
          setTimeout(() => {
            setShowEliminationMessage(false);
          }, 6000);
        }
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

  // Sidebar toggle
  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  return (
    <div
      className={`chatroom-container ${
        currentPhase === "night" ? "night-mode" : ""
      } ${isEliminated ? "eliminated" : ""}`}
    >
      {/* 1) Full-width chatroom header */}
      <div className="chatroom-header">
        <h2>{currentPhase === "voting" ? "DAY" : currentPhase.toUpperCase()}</h2>

        {/* Hamburger button to toggle sidebar */}
        <button className="hamburger-button" onClick={toggleSidebar}>
          <span className="hamburger-icon" />
        </button>

        <div className="phase-timer">{formatTime(timeLeft)}</div>
      </div>

      {/* 2) Body container: flex row => sidebar + chat content */}
      <div className="chatroom-body">

        {/* Sidebar */}
        <div className={`sidebar ${isSidebarOpen ? "open" : "closed"}`}>

          {/* Dropdown entries container */}
          <div className="role-info-container">
            {role && (
              <div className="dropdown-entry">
                <div
                  className="dropdown-header"
                  onClick={() => setIsRoleDropdownOpen((prev) => !prev)}
                >
                <div 
                  className={`dropdown-title ${role && role.toLowerCase() === "mafia" ? "role-mafia" : "role-villager"}`}
                >
                  <div>Your Role: <span className="role-name">{role}</span></div>
                </div>
                  <div className="dropdown-icon">
                    {isRoleDropdownOpen ? "▼" : "►"}
                  </div>
                </div>
                {isRoleDropdownOpen && (
                  <div className="role-rules">
                    {role === "Mafia" && "Mafia Rules: "}
                    {role === "Villager" && "Villager Rules: "}
                    {role === "Doctor" && "Doctor Rules: "}
                    {role === "Detective" && "Detective Rules: "}
                  </div>
                )}
              </div>
            )}
            <div className="dropdown-entry">
              <div
                className="dropdown-header"
                onClick={() => setIsFullRuleDropdownOpen((prev) => !prev)}
              >
                <div className="dropdown-title">Full Rule</div>
                <div className="dropdown-icon">
                  {isFullRuleDropdownOpen ? "▼" : "►"}
                </div>
              </div>
              {isFullRuleDropdownOpen && (
                <div className="dropdown-content">
                  <div className="full-rule-text">
                    Full rule
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Return to Home button */}
          <button
            className="return-home-button"
            onClick={() => {
              socket.emit("leaveChatroom", { lobbyId, username });
              navigate("/");
            }}
          >
            <span className="home-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Open door shape */}
                <rect
                  x="2"
                  y="3"
                  width="10"
                  height="18"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                {/* Door knob */}
                <circle cx="10" cy="12" r="1" fill="currentColor" />
                {/* Arrow pointing outdoors */}
                <path
                  d="M14 12H22M18 8L22 12L18 16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            Return to Home
          </button>
        </div>

        {/* --- Main chat content --- */}
        <div className="chat-content">

          {/* Messages */}
          <div className="chatroom-messages">
            {messages.map((m, idx) => (
              <div key={idx} className="chatroom-message">
                <span className="chatroom-username">{m.sender}: </span>
                <span className="chatroom-text">{m.text}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area (if allowed) */}
          {!(currentPhase === "voting" || currentPhase === "night") && (
            <div
              className={`chatroom-input-container ${
                isEliminated ? "disabled" : ""
              }`}
            >
              <textarea
                className="chatroom-input"
                rows="4"
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
          )}

          {/* Voting popup */}
          {isVoting && !isEliminated && (
            <VotingPopup
              players={players}
              onVote={(targetPlayer) => {
                socket.emit("submit_vote", {
                  lobbyId,
                  voteId,
                  voter: username,
                  target: targetPlayer,
                });
                setIsVoting(false);
              }}
              onClose={() => {
                socket.emit("submit_vote", {
                  lobbyId,
                  voteId,
                  voter: username,
                  target: "s3cr3t_1nv1s1bl3_pl@y3r",
                });
                setIsVoting(false);
              }}
              role={voteType === "mafia" ? "Mafia" : "Villager"}
              username={username}
              lobbyId={lobbyId}
            />
          )}

          {showEliminationMessage && (
            <div className="elimination-message">
              Your presence fades into the unknown… AI takes your place.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatroomPage;