import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import socket from "../service/socket";
import VotingPopup from "../components/VotingPopup"; // Import the Voting Popup
import "../styles/ChatroomPage.css";

const ChatroomPage = () => {
  const navigate = useNavigate();
  const { lobbyId } = useParams();
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [username, setUsername] = useState("");
  const usernameRef = useRef(""); // this will hold the true current username for event callbacks
  const messagesEndRef = useRef(null);
  const [role, setRole] = useState(null);
  const [socketStatus, setSocketStatus] = useState(socket.connected ? "connected" : "disconnected");
  // Voting states
  const [players, setPlayers] = useState([]); 
  const [isVoting, setIsVoting] = useState(false);
  const [voteType, setVoteType] = useState("villager"); // "villager" or "mafia"
  const [voteId, setVoteId] = useState(null);
  const [isVoteLocked, setIsVoteLocked] = useState(false); // used to disable chat when mafia vote is in progress
  const [isEliminated, setIsEliminated] = useState(false); // once eliminated, the user can only watch

  // Debugging logger
  const debugLog = (message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`, data);
  };

  // 1. Retrieve username and initialize socket monitoring
  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
      usernameRef.current = storedUsername;
      console.log("[DEBUG] Username loaded:", storedUsername);
    } else {
      navigate("/");
    }

    // If the socket is already connected, update the status
    if (socket.connected) {
      setSocketStatus("connected");
      debugLog("Socket already connected", socket.id);
    }

    // Socket connection monitoring
    const handleConnect = () => {
      debugLog("Socket connected", socket.id);
      setSocketStatus("connected");
    };

    const handleDisconnect = () => {
      debugLog("Socket disconnected");
      setSocketStatus("disconnected");
    };

    const handleConnectError = (err) => {
      debugLog("Socket connection error:", err.message);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
    };
  }, [navigate]);

  // 2. Role assignment handler (fixed dependency array)
  useEffect(() => {
    debugLog("Initializing role assignment listener");
    
    const handleRoleAssignment = (data) => {
      debugLog("ROLE ASSIGNMENT RECEIVED", {
        receivedRole: data.role,
        fullPayload: data,
        currentSocket: socket.id,
        connectionStatus: socket.connected
      });
      setRole(data.role);
    };

    socket.on("roleAssigned", handleRoleAssignment);

    return () => {
      debugLog("Cleaning up role assignment listener");
      socket.off("roleAssigned", handleRoleAssignment);
    };
  }, []); // Removed socket from dependencies

  // 3. Message handling and scrolling
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 4. Chat message handling
  useEffect(() => {
    debugLog("Initializing message handlers");
    
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
      debugLog("Cleaning up message handlers");
      socket.off("message", handleMessage);
      socket.off("lobbyError", handleLobbyError);
    };
  }, [navigate]);

  // 5. Chatroom joining/leaving with connection verification
  useEffect(() => {
    if (!socket || !lobbyId || !username) return;
    debugLog("Attempting to join chatroom", {
      lobbyId,
      username,
      socketConnected: socket.connected,
      socketId: socket.id
    });
    const joinTimeout = setTimeout(() => {
      if (!socket.connected) {
        debugLog("Join timeout - socket not connected");
        alert("Connection timeout. Please refresh the page.");
      }
    }, 5000);

    socket.emit("joinChatroom", { lobbyId, username }, (response) => {
      clearTimeout(joinTimeout);
      if (response?.error) {
        debugLog("Join error", response.error);
        alert(response.error);
      } else {
        debugLog("Successfully joined chatroom. Requesting role...");
        socket.emit("requestRole", { lobbyId });
      }
    });

    return () => {
      debugLog("Leaving chatroom");
      socket.emit("leaveChatroom", { lobbyId, username });
    };
  }, [lobbyId, username]);

  // 6. Message sending (chat disabled when vote locked or eliminated)
  const handleSendMessage = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !chatDisabled) {
      setMessage("");
      debugLog("Sending message", { message: trimmedMessage, lobbyId });
      socket.emit(
        "sendMessage",
        { lobbyId, text: trimmedMessage },
        (deliveryConfirmation) => {
          if (deliveryConfirmation?.error) {
            debugLog("Message delivery failed", deliveryConfirmation.error);
          } else {
            debugLog("Message delivered successfully");
          }
        }
      );
    }
  };

  // 7. Update players list (only update if not currently voting)
  useEffect(() => {
    const handlePlayersList = (playerList) => {
      if (!isVoting) {
        console.log("[DEBUG] Received players list from server:", playerList);
        setPlayers(playerList);
      }
    };
    socket.on("playersList", handlePlayersList);
    return () => {
      socket.off("playersList", handlePlayersList);
    };
  }, [isVoting]);

  // 8. Voting System: Start Voting
  const startVoting = () => {
    console.log("[DEBUG] Start Voting button clicked.");
    // Reset voting states
    setIsVoting(false);
    setIsVoteLocked(false);
    // Emit vote start event (voteType is taken from the select control)
    socket.emit("start_vote", { voteType, lobbyId });
  };

  // 9. Voting event listeners
  useEffect(() => {
    socket.on("open_voting", ({ voteType: incomingVoteType, voteId: incomingVoteId, players: incomingPlayers }) => {
      setVoteType(incomingVoteType);
      setVoteId(incomingVoteId);
      const currentUser = usernameRef.current;
      // Filter out self using the ref – ensuring both are strings.
      const filteredPlayers = incomingPlayers.filter(p => String(p) !== String(currentUser));
      console.log(`[DEBUG open_voting] incomingPlayers: ${JSON.stringify(incomingPlayers)}, username: ${currentUser}, filtered: ${JSON.stringify(filteredPlayers)}`);
      setPlayers(filteredPlayers);
      if (incomingVoteType === "mafia") {
        if (role && role.toLowerCase() === "mafia") {
          setIsVoting(true);
        } else {
          setIsVoteLocked(true);
        }
      } else {
        setIsVoting(true);
      }
    });

    socket.on("voting_complete", ({ eliminated }) => {
      console.log("[DEBUG] Voting completed. Eliminated:", eliminated);
      setIsVoting(false);
      setIsVoteLocked(false);
      if (eliminated && eliminated === usernameRef.current) {
        setIsEliminated(true);
      }
    });

    return () => {
      socket.off("open_voting");
      socket.off("voting_complete");
    };
  }, [role]); 

// Disable chat if eliminated or if a mafia vote is in progress and the player is not mafia
const chatDisabled =
  isEliminated ||
  (voteType === "mafia" && isVoting && role && role.toLowerCase() !== "mafia") ||
  isVoteLocked;

  // 9. UI components with connection status display
  return (
    <div className="chatroom-container">
      {/* <div className="connection-status">
        Connection: {socketStatus} | Socket ID: {socket.connected ? socket.id : "N/A"}
      </div> */}
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
          <button onClick={startVoting} className="vote-button">
            Start Voting
          </button>
        </div>
      </div>

      {role && (
        <div className={`role-banner ${role.toLowerCase() === 'mafia' ? 'mafia' : ''}`}>
          Your Role: <span className="role-name">{role}</span>
        </div>
      )}

      <div className="chatroom-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className="chatroom-message">
            <span className="chatroom-timestamp">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
            <span className="chatroom-username">{msg.sender}: </span>
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
              e.preventDefault(); // Prevent default form behavior
              handleSendMessage();
            }
          }}
        />
        <button className="chatroom-send-button" onClick={handleSendMessage}>
          Send
        </button>
      </div>

      {/* 🔥 VotingPopup: shown only for players eligible to vote */}
      {isVoting && (
        <VotingPopup
          players={players}
          onVote={(player) => {
            console.log(`[DEBUG] Vote submitted for ${player}`);
            socket.emit("submit_vote", { lobbyId, voteId, voter: username, target: player });
          }}
          onClose={() => {
            console.log("[DEBUG] Voting popup closed");
            setIsVoting(false);
          }}
          role={voteType === "mafia" ? "Mafia" : "Villager"}
          username={username}
          lobbyId={lobbyId}
        />
      )}
  </div>
  );
};

export default ChatroomPage;
