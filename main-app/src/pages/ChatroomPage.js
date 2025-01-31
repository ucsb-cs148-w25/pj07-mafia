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
  const [role, setRole] = useState(null);
  const [socketStatus, setSocketStatus] = useState(
    socket.connected ? "connected" : "disconnected"
  );
  const [players, setPlayers] = useState([]); 
  const messagesEndRef = useRef(null);

  // NEW: Only show vote buttons after we receive a "startVoting" event
  const [votingActive, setVotingActive] = useState(false);

  // Debug logger
  const debugLog = (msg, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${msg}`, data);
  };

  // 1. Connection & event listeners
  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
      debugLog("Username loaded from storage:", storedUsername);
    } else {
      navigate("/");
    }

    if (socket.connected) {
      setSocketStatus("connected");
      debugLog("Socket already connected", socket.id);
    }

    // Built-in disconnect event
    const handleDisconnect = (reason) => {
      debugLog("Socket disconnected. Reason:", reason);
      setSocketStatus("disconnected");
    };
    socket.on("disconnect", handleDisconnect);

    // Players updated
    const handleUpdateAllPlayers = (data) => {
      debugLog("Received updateAllPlayers event:", data);
      if (data?.players) {
        setPlayers(data.players);
      }
    };
    socket.on("updateAllPlayers", handleUpdateAllPlayers);

    // NEW: startVoting event
    const handleStartVoting = () => {
      debugLog("Received 'startVoting' event - voting is now active!");
      setVotingActive(true);
    };
    socket.on("startVoting", handleStartVoting);

    return () => {
      socket.off("disconnect", handleDisconnect);
      socket.off("updateAllPlayers", handleUpdateAllPlayers);
      socket.off("startVoting", handleStartVoting);
    };
  }, [navigate]);

  // 2. Role assignment
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

  // 3. Scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 4. Message & Error handlers
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

  // 5. Joining the lobby
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

  // 6. Sending messages
  const handleSendMessage = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage) {
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

  // 7. Listen for initial or updated players list
  useEffect(() => {
    const handlePlayersList = (playerList) => {
      debugLog("Received players list:", playerList);
      setPlayers(playerList);
    };

    socket.on("playersList", handlePlayersList);
    return () => {
      socket.off("playersList", handlePlayersList);
    };
  }, []);

  // 8. Voting
  const handleCastVote = (targetSocketId) => {
    debugLog("Casting vote against socketId:", targetSocketId);
    socket.emit("castVote", { targetId: targetSocketId });
  };

  const handleDayPhase = () => {
    debugLog("Emitting dayPhase");
    socket.emit("dayPhase", { lobbyId });
  };

  const handleNightPhase = () => {
    debugLog("Emitting nightPhase");
    socket.emit("nightPhase", { lobbyId });
  };

  return (
    <div className="chatroom-wrapper">
      <div className="chatroom-container">
        <div className="chatroom-main">
          <div className="chatroom-header">
            <h2>Chatroom</h2>
            <button className="back-button" onClick={() => navigate("/")}>
              Back to Home
            </button>
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
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <button className="chatroom-send-button" onClick={handleSendMessage}>
              Send
            </button>
          </div>

          {/* NEW: Day/Night Phase Buttons */}
          <div className="phase-controls" style={{ marginTop: "1rem" }}>
            <button onClick={handleDayPhase} className="day-phase-btn">
              Day Phase
            </button>
            <button
              onClick={handleNightPhase}
              className="night-phase-btn"
              style={{ marginLeft: "0.5rem" }}
            >
              Night Phase
            </button>
          </div>
        </div>

        {/* Voting panel */}
        <div className="vote-container">
          <h3>Vote</h3>
          {players.map((player) => (
            <button
              key={player.socketId}
              onClick={() => handleCastVote(player.socketId)}
              className="vote-button"
              disabled={!player.isAlive}
              style={{
                backgroundColor: !player.isAlive ? "#ccc" : "",
                cursor: !player.isAlive ? "not-allowed" : "pointer",
                marginBottom: "0.5rem",
                display: "block"
              }}
            >
              {player.username}
              {!player.isAlive && " (Dead)"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChatroomPage;
