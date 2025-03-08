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

  // 9. chatDisabled logic
  const chatDisabled = isEliminated ||
    (voteType === "mafia" && isVoting && role?.toLowerCase() !== "mafia") ||
    isVoteLocked;

  // 10. Handle sending a message: filter via Claude then update conversation log.
  // Also trigger eliminated players’ AI responses if random chance succeeds.
  const handleSendMessage = async () => {
    if (!message.trim() || chatDisabled) return;
    try {
      // First, call the rewrite endpoint to get the filtered message.
      const response = await fetch(`${config.backendUrl}/api/claude/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      });
  
      if (response.ok) {
        const data = await response.json();
        const rewrittenMessage = data.rewrittenMessage;
  
        if (rewrittenMessage) {
          // Emit the filtered message to the chatroom.
          socket.emit("sendMessage", { lobbyId, text: rewrittenMessage, senderName: username });
          // Create the new log entry.
          const newEntry = { sender: username, content: rewrittenMessage };
          // Update the conversation log.
          const updatedLog = [...conversationLog, newEntry];
          // Only trigger AI responses if this new entry was sent by the current user.
          if (newEntry.sender === username) {
            let currentThres = thres;
            eliminatedPlayers.forEach((elim) => {
              const R = Math.random();
              console.log(`[AI GENERATION] R = ${R}`);
              if (R > currentThres) {
                console.log(`[AI GENERATION] R is bigger than the threshold = ${currentThres}, expect AI message from player ${elim}`);
                currentThres = currentThres + 0.1;
                const conversationText = updatedLog
                  .map((msg) => `sender: ${msg.sender}, content: ${msg.content}`)
                  .join("\n");
  
                // Call the genResponse endpoint.
                fetch(`${config.backendUrl}/api/claude/genResponse`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    conversationText,
                    eliminatedPlayerName: elim,
                  }),
                })
                  .then((res) => res.json())
                  .then((result) => {
                    if (result.responseText) {
                      // Emit the generated message as if sent by the eliminated player.
                      socket.emit("sendMessage", { lobbyId, text: result.responseText, senderName: elim });
                      // Update the conversation log with this new message.
                      setConversationLog((prevLog) => [
                        ...prevLog,
                        { sender: elim, content: result.responseText },
                      ]);
                    }
                  })
                  .catch((err) => {
                    console.error("Error generating response for eliminated player", elim, err);
                  });
              }
            });
          }
          setMessage(""); // Clear the input field.
        } else {
          console.error("No rewrittenMessage found in the response");
        }
      } else {
        const errorData = await response.json();
        console.error("Error:", errorData.error);
      }
    } catch (error) {
      console.error("Error calling Claude API:", error);
    }
  };
  

  // 11. format time
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className={`chatroom-container ${currentPhase === "night" ? "night-mode" : ""} ${isEliminated ? "eliminated" : ""}`}>
      <div className="chatroom-header">
        <h2>{currentPhase === "voting" ? "DAY" : currentPhase.toUpperCase()}</h2>
        {/* <button className="back-button" onClick={() => navigate("/")}>Back to Home</button> */}

        <div className="phase-timer">{formatTime(timeLeft)}</div>
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

      {!(currentPhase === "voting" || currentPhase === "night") && (
        <div className={`chatroom-input-container ${isEliminated ? "disabled" : ""}`}>
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
          <button 
            className="chatroom-send-button" 
            onClick={handleSendMessage}
            // disabled={chatDisabled}
          >
            Send
          </button>
        </div>
      )}

      {isVoting && !isEliminated && (
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
          onClose={() => {
            // Treat cancellation as a vote with a default target value (e.g., "abstain")
            debugLog(`Vote cancelled by ${username}`);
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
          <div className="elimination-message">Your presence fades into the unknown… AI takes your place.</div>
      )}
      </div>
  );
};

export default ChatroomPage;