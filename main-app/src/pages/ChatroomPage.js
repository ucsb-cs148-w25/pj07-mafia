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
  const [role, setRole] = useState(null);
  const [socketStatus, setSocketStatus] = useState("disconnected");

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
      debugLog("Username loaded from storage:", storedUsername);
    } else {
      navigate("/");
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
      }
    });

    return () => {
      debugLog("Leaving chatroom");
      socket.emit("leaveChatroom", { lobbyId, username });
    };
  }, [lobbyId, username]);

  // 6. Message sending with delivery confirmation
  const handleSendMessage = () => {
    if (message.trim()) {
      debugLog("Sending message", { message, lobbyId });
      socket.emit("sendMessage", {
        lobbyId,
        text: message.trim()
      }, (deliveryConfirmation) => {
        if (deliveryConfirmation?.error) {
          debugLog("Message delivery failed", deliveryConfirmation.error);
        } else {
          debugLog("Message delivered successfully");
          setMessage("");
        }
      });
    }
  };

  // 7. UI components with connection status display
  return (
    <div className="chatroom-container">
      <div className="connection-status">
        Connection: {socketStatus} | Socket ID: {socket.id}
      </div>
      
      <div className="chatroom-header">
        <h2>Chatroom</h2>
        <button className="back-button" onClick={() => navigate("/")}>
          Back to Home
        </button>
      </div>

      {role && (
        <div className="role-banner">
          Your Role: <span className="role-name">{role}</span>
        </div>
      )}

      <div className="chatroom-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className="chatroom-message">
            <span className="chatroom-timestamp">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
            <span className="chatroom-username">{msg.sender}:</span>
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
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
        />
        <button className="chatroom-send-button" onClick={handleSendMessage}>
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatroomPage;