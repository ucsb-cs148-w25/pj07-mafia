import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import socket from "../service/socket";
import VotingPopup from "../components/VotingPopup"; 
import "../styles/ChatroomPage.css";
import config from "../config";

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

  const [conversationLog, setConversationLog] = useState([]);
  const [eliminatedPlayers, setEliminatedPlayers] = useState([]);
  // Preset probability threshold (P)
  const thres = config.THRESHOLD;

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

  // 4. Listen for message: update both displayed messages and conversation log
  useEffect(() => {
    const handleMessage = (m) => {
      debugLog("message", m);
      setMessages((prev) => [...prev, m]);
      if (currentPhase === "day"){ //only updates log during the day (for future mafia discussion integration)
        if (m.sender !== "System"){
          setConversationLog((prev) => [...prev, { sender: m.sender, content: m.text }]);
        }
      }
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
          // Use a functional update so that the latest state is used.
          setIsEliminated(prevIsEliminated => {
            if (!prevIsEliminated) {
              console.log("[ELIMINATION] message displayed");
              setShowEliminationMessage(true);
              setTimeout(() => {
                setShowEliminationMessage(false);
              }, 6000);
            }
            return true;
          });
          setIsEliminated(true);
          console.log("[DEBUG] Set IsEliminated to True");
        } else {
          setEliminatedPlayers((prev) => {
            if (!prev.includes(eliminated)) {
              console.log("[DEBUG] Adding eliminated player:", eliminated);
              return [...prev, eliminated];
            }
            return prev;
          });
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

  // 10. handleSendMessage => no local rewriting. Let server handle it for living players.
  // Also, after sending, do random AI generation for each eliminated player.
  const handleSendMessage = () => {
    if (!message.trim()) return;
    const newText = message.trim();

    // If I'm alive => "sendMessage"
    // If I'm dead => "sendGhostMessage"
    if (!isEliminated) {
      socket.emit("sendMessage", { lobbyId, text: newText, senderName: username });
    } else {
      socket.emit("sendGhostMessage", { lobbyId, text: newText });
    }

    // If it's day and not system => add to conversation log
    if (currentPhase === "day") {
      const newEntry = { sender: username, content: newText };
      const updatedLog = [...conversationLog, newEntry];
      setConversationLog(updatedLog);

      // Attempt random AI for each eliminated player
      let localThres = thres;
      eliminatedPlayers.forEach(deadName => {
        const R = Math.random();
        if (R > localThres) {
          localThres += 0.1; // increment threshold or your chosen logic
          console.log(`[AI GEN] chance triggered for ${deadName}`);
          const conversationText = updatedLog
            .map(msg => `sender: ${msg.sender}, content: ${msg.content}`)
            .join("\n");

          // call genResponse to get an AI message
          fetch(`${config.backendUrl}/api/claude/genResponse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationText,
              eliminatedPlayerName: deadName,
            }),
          })
          .then(res => res.json())
          .then((result) => {
            if (result.responseText) {
              // Now we want the AI to speak as "deadName" in the main chat, ignoring isAlive
              socket.emit("sendAiMessage", {
                lobbyId,
                text: result.responseText,
                eliminatedPlayerName: deadName
              });
            }
          })
          .catch(err => {
            console.error("[AI ERROR]", err);
          });
        }
      });
    }

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
        <div className={`sidebar ${isSidebarOpen ? "open" : "closed"}`} style={{ overflowY: "auto" }}>

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
                    {role === "Mafia" && (
                      <div>
                        <h3>Mafia Rules</h3>
                        <p>
                          <strong>Team:</strong> You are on the Mafia team.
                          <br />
                          <strong>Objective:</strong> Eliminate all Villagers without being exposed.
                          <br />
                          <strong>Actions:</strong> During the night, collaborate secretly with fellow Mafia members to choose a victim. During the day, blend in with others and misdirect suspicion.
                        </p>
                      </div>
                    )}
                    {role === "Villager" && (
                      <div>
                        <h3>Villager Rules</h3>
                        <p>
                          <strong>Team:</strong> You are on the Villagers team.
                          <br />
                          <strong>Objective:</strong> Identify and eliminate the Mafia.
                          <br />
                          <strong>Actions:</strong> Participate in daily discussions, share suspicions, and vote to eliminate players who you suspect are Mafia.
                        </p>
                      </div>
                    )}
                    {role === "Doctor" && (
                      <div>
                        <h3>Doctor Rules</h3>
                        <p>
                          <strong>Team:</strong> You are on the Villagers team.
                          <br />
                          <strong>Objective:</strong> Protect Villagers from being eliminated by the Mafia.
                          <br />
                          <strong>Actions:</strong> Each night, choose one player to safeguard. Your protection may prevent a Mafia attack if you guess correctly.
                        </p>
                      </div>
                    )}
                    {role === "Detective" && (
                      <div>
                        <h3>Detective Rules</h3>
                        <p>
                          <strong>Team:</strong> You are on the Villagers team.
                          <br />
                          <strong>Objective:</strong> Uncover the identity of the Mafia.
                          <br />
                          <strong>Actions:</strong> Every night, investigate a player to gather clues about their role. Use your findings during discussions to help identify Mafia members.
                        </p>
                      </div>
                    )}
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
                    <h2>Full Rules of Mafia</h2>
                    <p><strong>Game Setup:</strong> This is a normal game of Mafia with the following roles:</p>
                    <ul>
                      <li><strong>Villager:</strong> Works with others to identify and eliminate the Mafia.</li>
                      <li><strong>Mafia:</strong> Secretly works to eliminate the Villagers while staying hidden.</li>
                      <li><strong>Doctor:</strong> Can protect a player from being eliminated during the night phase.</li>
                      <li><strong>Inspector:</strong> Investigates players to determine if they might be Mafia.</li>
                      <li><strong>Detective:</strong> Uses clues and deductions to help identify the Mafia, working closely with the Villagers.</li>
                    </ul>
                    <p><strong>Game Phases:</strong></p>
                    <ol>
                      <li><em>Night:</em> The Mafia chooses a victim, while the Doctor selects someone to protect. The Inspector and Detective gather information.</li>
                      <li><em>Day:</em> All players discuss, debate, and vote on who they suspect is Mafia. The player with the majority vote is eliminated.</li>
                    </ol>
                    <p><strong>Twists:</strong></p>
                    <ul>
                      <li><em>AI Rephrasing:</em> Any text you send during the game will be parsed and rephrased by an AI. This helps maintain consistency in language and style throughout the game.</li>
                      <li><em>AI Replacement:</em> When you die, you will be replaced by an AI that takes over your character, ensuring the game continues smoothly without interruption.</li>
                    </ul>
                    <p>Use strategy, observation, and collaboration to outsmart the opposing side and secure victory!</p>
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

          {/* Chat Input - always shown. Optionally disable if you want for eliminated players. */}
          <div className={`chatroom-input-container`}>
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