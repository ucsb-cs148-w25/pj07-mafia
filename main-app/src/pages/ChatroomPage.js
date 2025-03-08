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

  // 4. Listen for message and night results
  useEffect(() => {
    const handleMessage = (m) => {
      debugLog("message", m);
      
      // Special handling for private messages (like detective results)
      if (m.isPrivate) {
        const privateMessage = {
          ...m,
          isPrivate: true, // Make sure this flag is set for display purposes
          text: `[PRIVATE] ${m.text}` // Prefix with PRIVATE for clarity
        };
        setMessages(prev => [...prev, privateMessage]);
      } else {
        setMessages(prev => [...prev, m]);
      }
    };
    
    // Handler for night results
    const handleNightResults = (results) => {
      console.log("[DEBUG] Received night results:", results);
      // We'll handle any special night results processing here
    };
    
    // Handler for detective investigation results
    const handleDetectiveResult = (result) => {
      console.log("[DEBUG] Received detective result:", result);
      
      // Only show to the detective
      if (result.forUsername === username) {
        const privateMessage = {
          ...result,
          isPrivate: true,
          text: `[INVESTIGATION] ${result.text}` // Special prefix for investigations
        };
        setMessages(prev => [...prev, privateMessage]);
      }
    };
    
    // Handler for vote acknowledgments (closes the voting popup for just this client)
    const handleVoteAcknowledged = (data) => {
      console.log("[DEBUG] Vote acknowledged:", data);
      // Adding a small delay to prevent UI freeze
      setTimeout(() => {
        setIsVoting(false); // Close the voting popup only for this client
      }, 100);
    };
    
    socket.on("message", handleMessage);
    socket.on("night_results", handleNightResults);
    socket.on("detective_result", handleDetectiveResult);
    socket.on("vote_acknowledged", handleVoteAcknowledged);
    
    return () => {
      socket.off("message", handleMessage);
      socket.off("night_results", handleNightResults);
      socket.off("detective_result", handleDetectiveResult);
      socket.off("vote_acknowledged", handleVoteAcknowledged);
    };
  }, [username]); // Add username as dependency

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
    if (currentPhase === "voting") {
      console.log("[DEBUG] Auto initiating day voting", { lobbyId });
      socket.emit("start_vote", { voteType: "villager", lobbyId });
    } 
    else if (currentPhase === "night") {
      // Night phase - initiating role-specific votes
      if (role) {
        const lowerRole = role.toLowerCase();
        
        if (lowerRole === "mafia") {
          console.log("[DEBUG] Auto initiating mafia voting", { lobbyId });
          socket.emit("start_vote", { voteType: "mafia", lobbyId });
        } 
        else if (lowerRole === "doctor") {
          console.log("[DEBUG] Auto initiating doctor voting", { lobbyId });
          socket.emit("start_vote", { voteType: "doctor", lobbyId });
        } 
        else if (lowerRole === "detective") {
          console.log("[DEBUG] Auto initiating detective voting", { lobbyId });
          socket.emit("start_vote", { voteType: "detective", lobbyId });
        }
      }
    }
  }, [currentPhase, role, lobbyId, isEliminated, votingInitiated]);

  // 8. open_voting / voting_complete
  useEffect(() => {
    const handleOpenVoting = ({ voteType: incType, voteId: incId, players: incPlayers }) => {
      debugLog("open_voting", { incType, incId, incPlayers });
      console.log("[DEBUG] Received vote type:", incType, "Current user role:", role);
      
      // Remove yourself from the target list if you don't want self votes
      const filtered = incPlayers.filter(
        (playerUsername) =>
          playerUsername.trim().toLowerCase() !== username.trim().toLowerCase()
      );
      setPlayers(filtered);

      // Set the vote ID
      setVoteId(incId);
      
      // Only show voting popup for the appropriate role
      let shouldShowVoting = false;
      
      // Each role should only see their specific vote type
      if (incType === "mafia" && role?.toLowerCase() === "mafia") {
        shouldShowVoting = true;
        setVoteType("mafia");
        console.log("[DEBUG] Showing mafia kill vote popup");
      } 
      else if (incType === "doctor" && role?.toLowerCase() === "doctor") {
        shouldShowVoting = true;
        setVoteType("doctor");
        console.log("[DEBUG] Showing doctor save vote popup");
      } 
      else if (incType === "detective" && role?.toLowerCase() === "detective") {
        shouldShowVoting = true;
        setVoteType("detective");
        console.log("[DEBUG] Showing detective investigate vote popup");
      } 
      else if (incType === "villager") {
        // Everyone votes during day phase
        shouldShowVoting = true;
        setVoteType("villager");
        console.log("[DEBUG] Showing villager vote popup");
      }
      
      // Only show voting popup if this user is eligible
      if (shouldShowVoting) {
        setIsVoting(true);
      } else {
        setIsVoteLocked(false); // Don't lock chat for ineligible roles
      }
    };

    const handleVotingComplete = ({ eliminated, voteType: completedVoteType }) => {
      debugLog("voting_complete", { eliminated, username, completedVoteType });
      
      // Global voting completion - affects all players
      setIsVoting(false); // Close any open voting popups
      setIsVoteLocked(false); // Unlock chat input
      
      // Handle elimination if there was one
      if (eliminated) {
        if (eliminated.trim().toLowerCase() === username.trim().toLowerCase()) {
          setIsEliminated(true);
          console.log("[DEBUG] Set IsEliminated to True");
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
          <div 
            key={idx} 
            className={`chatroom-message ${m.isPrivate ? 'private-message' : ''}`}
          >
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
            debugLog(`Vote submitted in ChatroomPage for ${targetPlayer}, role=${role}, voteType=${voteType}`);
            // The VotingPopup component now handles socket emission directly
            // No need to emit here, just for logging
          }}
          onClose={() => {
            // Treat cancellation as a vote with a default target value (e.g., "abstain")
            debugLog(`Vote cancelled in ChatroomPage by ${username}`);
            // The VotingPopup component now handles socket emission directly
            // No need to emit here, just for logging
          }}
          role={voteType.charAt(0).toUpperCase() + voteType.slice(1)}
          username={username}
          lobbyId={lobbyId}
        />
      )}
      {/* Debug voteType */}
      <div style={{ display: 'none' }}>Current voteType: {voteType}</div>
      {showEliminationMessage && (
          <div className="elimination-message">Your presence fades into the unknown… AI takes your place.</div>
      )}
      </div>
  );
};

export default ChatroomPage;