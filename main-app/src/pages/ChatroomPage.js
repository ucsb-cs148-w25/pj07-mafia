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
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [doctorVoteSubmitted, setDoctorVoteSubmitted] = useState(false);
  const [detectiveVoteSubmitted, setDetectiveVoteSubmitted] = useState(false);
  const [mafiaVoteSubmitted, setMafiaVoteSubmitted] = useState(false);

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

  // 4. Listen for message, private_message, and vote acknowledgements
  useEffect(() => {
    const handleMessage = (m) => {
      debugLog("message", m);
      setMessages(prev => [...prev, m]);
    };
    
    const handlePrivateMessage = (m) => {
      debugLog("private_message", m);
      // Add a class or styling to indicate this is a private message
      setMessages(prev => [...prev, { ...m, isPrivate: true }]);
    };
    
    const handleVoteAcknowledged = (data) => {
      debugLog("vote_acknowledged", data);
      
      // Handle different vote types
      if (data.voteType === "mafia") {
        console.log("[VOTE STATUS] Mafia vote acknowledged by server");
        setMafiaVoteSubmitted(true);
      } 
      else if (data.voteType === "doctor") {
        console.log("[VOTE STATUS] Doctor vote acknowledged by server");
        setDoctorVoteSubmitted(true);
      }
      else if (data.voteType === "detective") {
        console.log("[VOTE STATUS] Detective vote acknowledged by server");
        setDetectiveVoteSubmitted(true);
      }
      
      // Add the acknowledgement as a private message
      setMessages(prev => [...prev, { 
        sender: "System", 
        text: data.message, 
        timestamp: new Date(),
        isPrivate: true
      }]);
    };
    
    socket.on("message", handleMessage);
    socket.on("private_message", handlePrivateMessage);
    socket.on("vote_acknowledged", handleVoteAcknowledged);
    
    return () => {
      socket.off("message", handleMessage);
      socket.off("private_message", handlePrivateMessage);
      socket.off("vote_acknowledged", handleVoteAcknowledged);
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

  // Track the last seen phase to detect phase changes
  const lastPhaseRef = useRef(currentPhase);
  
  // 7. automated voting popup - trigger both on phase change and role assignment
  useEffect(() => {
    if (isEliminated) {
      console.log(`[CHATROOM] this user is eliminated`);
      return;
    }
    
    // Detect phase changes
    const phaseChanged = currentPhase !== lastPhaseRef.current;
    lastPhaseRef.current = currentPhase;
    
    // Reset voting state when phase changes
    if (phaseChanged) {
      console.log(`[DEBUG] Phase changed to ${currentPhase}`);
      setIsVoting(false);
      setIsVoteLocked(false);
      
      // When night phase starts, emit the appropriate vote request based on role
      if (currentPhase === "night" && role) {
        const lowerRole = role.toLowerCase();
        
        // For mafia members
        if (lowerRole === "mafia") {
          console.log("[DEBUG] Initiating mafia voting");
          socket.emit("start_vote", { voteType: "mafia", lobbyId });
        }
        // For doctors
        else if (lowerRole === "doctor") {
          console.log("[DEBUG] Initiating doctor voting");
          socket.emit("start_vote", { voteType: "doctor", lobbyId });
        }
        // For detectives
        else if (lowerRole === "detective") {
          console.log("[DEBUG] Initiating detective voting");
          socket.emit("start_vote", { voteType: "detective", lobbyId });
        }
      }
      
      // When day voting phase starts
      if (currentPhase === "voting") {
        console.log("[DEBUG] Initiating day voting");
        socket.emit("start_vote", { voteType: "villager", lobbyId });
      }
    }
  }, [currentPhase, role, lobbyId, isEliminated]);

  // 8. open_voting / voting_complete
  useEffect(() => {
    const handleOpenVoting = ({ voteType: incType, voteId: incId, players: incPlayers }) => {
      debugLog("open_voting", { incType, incId, incPlayers });
      
      // Reset vote submitted state for new voting
      setVoteSubmitted(false);
      
      // remove yourself from the target list if you don't want self votes
      const filtered = incPlayers.filter(
        (playerUsername) =>
          playerUsername.trim().toLowerCase() !== username.trim().toLowerCase()
      );
      
      // Show voting popup based on role and vote type
      // Only show the popup to the appropriate role
      if (incType === "mafia" && role && role.toLowerCase() === "mafia") {
        // Only mafia sees the popup for mafia votes
        setVoteType(incType);
        setVoteId(incId);
        setPlayers(filtered);
        setIsVoting(true);
        console.log("[MAFIA VOTE] Opening mafia vote popup");
      } 
      else if (incType === "doctor" && role && role.toLowerCase() === "doctor") {
        // Only doctor sees the popup for doctor votes
        setVoteType(incType);
        setVoteId(incId);
        setPlayers(filtered);
        setIsVoting(true);
        console.log("[DOCTOR VOTE] Opening doctor vote popup");
      }
      else if (incType === "detective" && role && role.toLowerCase() === "detective") {
        // Only detective sees the popup for detective votes
        setVoteType(incType);
        setVoteId(incId);
        setPlayers(filtered);
        setIsVoting(true);
        console.log("[DETECTIVE VOTE] Opening detective vote popup");
      } 
      else if (incType === "villager") {
        // villager => everyone can vote
        setVoteType(incType);
        setVoteId(incId);
        setPlayers(filtered);
        setIsVoting(true);
        console.log("[VILLAGER VOTE] Opening villager vote popup for all players");
      }
      else {
        // Voting is happening but not for this role
        setIsVoteLocked(true);
      }
    };

    const handleVotingComplete = (result) => {
      debugLog("voting_complete", result);
      
      // Handle end-of-night update with composite result
      if (result && result.gameStateUpdate) {
        // This is a night phase end update - close all voting popups
        setIsVoting(false);
        setIsVoteLocked(false);
        
        // Check if this player was eliminated by mafia
        if (result.eliminated === username) {
          setIsEliminated(true);
        }
        return;
      }
      
      // Regular voting updates during the phase
      if (result && result.type) {
        // For day phase villager voting
        if (result.type === "villager") {
          setIsVoting(false);
          setIsVoteLocked(false);
          
          // Check for elimination
          if (result.eliminated === username) {
            setIsEliminated(true);
          }
        }
        // For night phase role votes, be more careful about state
        else if (result.type === "mafia" || result.type === "doctor" || result.type === "detective") {
          // Only close voting popup for the role that just voted
          if (
            (result.type === "mafia" && role && role.toLowerCase() === "mafia") ||
            (result.type === "doctor" && role && role.toLowerCase() === "doctor") ||
            (result.type === "detective" && role && role.toLowerCase() === "detective")
          ) {
            // We submitted our vote, mark it as done
            debugLog(`${result.type} vote registered, waiting for night phase end`);
            setVoteSubmitted(true);
          }
        }
      }
    };
    socket.on("open_voting", handleOpenVoting);
    socket.on("voting_complete", handleVotingComplete);
    return () => {
      socket.off("open_voting", handleOpenVoting);
      socket.off("voting_complete", handleVotingComplete);
    };
  }, [role, username, voteSubmitted]);

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
    <div className={`chatroom-container ${currentPhase === "night" ? "night-mode" : ""}`}>
      <div className="chatroom-header">
        <h2>{currentPhase === "voting" ? "DAY" : currentPhase.toUpperCase()}</h2>
        <button className="back-button" onClick={() => navigate("/")}>Back to Home</button>

        <div className="phase-timer">{formatTime(timeLeft)}</div>
      </div>

      {role && (
        <div className={`role-banner ${role.toLowerCase() === "mafia" ? "mafia" : ""}`}>
          Your Role: <span className="role-name">{role}</span>
        </div>
      )}

      <div className="chatroom-messages">
        {messages.map((m, idx) => (
          <div key={idx} className={`chatroom-message ${m.isPrivate ? 'private-message' : ''}`}>
            <span className="chatroom-username">{m.sender}: </span>
            <span className="chatroom-text">{m.text}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {!(currentPhase === "voting" || currentPhase === "night") && (
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
          role={
            voteType === "mafia" 
              ? "Mafia" 
              : voteType === "doctor" 
                ? "Doctor" 
                : voteType === "detective" 
                  ? "Detective" 
                  : "Villager"
          }
          username={username}
          lobbyId={lobbyId}
        />
      )}
    </div>
  );
};

export default ChatroomPage;