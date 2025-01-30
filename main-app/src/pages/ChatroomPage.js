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
  const [seconds, setSeconds] = useState(10); // Set 10 for testing, change to 60 for actual game
  //const [isRunning, setIsRunning] = useState(true);
  const [isNightMode, setIsNightMode] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  //const [isChanged, setIsChanged] = useState(false)
  const messagesEndRef = useRef(null);

  // 1. Retrieve username from localStorage
  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
    } else {
      navigate("/");
    }
  }, [navigate]);

  // 2. Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 3. Handle incoming messages and socket events
  useEffect(() => {
    if (!socket) return;

    function handleMessage(newMessage) {
      setMessages((prev) => [...prev, newMessage]);
    }

    function handleLobbyError(err) {
      alert(err.message);
      navigate("/");
    }

    socket.on("message", handleMessage);
    socket.on("lobbyError", handleLobbyError);

    return () => {
      socket.off("message", handleMessage);
      socket.off("lobbyError", handleLobbyError);
    };
  }, [navigate]);

  // 4. Join the chatroom
  useEffect(() => {
    if (!socket || !lobbyId || !username) return;

    socket.emit("joinChatroom", { lobbyId, username });

    return () => {
      socket.emit("leaveChatroom", { lobbyId, username });
    };
  }, [lobbyId, username]);

   /** 5. Listen for Server Timer & Phase Updates */
   useEffect(() => {
    if (!socket || !lobbyId) return;

    const handlePhaseChange = ({ phase, timer }) => {
      setIsNightMode(phase === "night");
      setSeconds(timer); // Update timer from server
    };

    const handleTimerUpdate = ({ timer }) => {
      setSeconds(timer);
    };

    socket.on("phaseChange", handlePhaseChange);
    socket.on("timerUpdate", handleTimerUpdate);

    return () => {
      socket.off("phaseChange", handlePhaseChange);
      socket.off("timerUpdate", handleTimerUpdate);
    };
  }, [lobbyId]);

  // 5. Timer Effect
    // useEffect(() => {
    //   if (!isRunning || isRestarting) return;

    //   const timer = setInterval(() => {
    //     setSeconds((prev) => {
    //       if (prev === 1) { // Use 1 instead of 0 to prevent double triggers
    //         clearInterval(timer);

    //         if (isNightMode) {
    //           setIsNightMode(false);
    //           socket.emit("dayTime", { lobbyId, isCreator });
    //           socket.off("dayTime", { lobbyId, isCreator });
    //           // setIsChanged(true);
    //         }
    //         else {
    //           setIsNightMode(true);
    //           socket.emit("nightTime", { lobbyId, isCreator });
    //           socket.off("nightTime", { lobbyId, isCreator });
    //           // setIsChanged(true);
    //         }

    //         setTimeout(() => {
    //           setSeconds(10); // Restart timer (change to 60 in actual game)
    //           setIsRestarting(true);
    //         }, 1000); // 1 sec before restarting

    //         return 0;
    //       }
    //       return prev - 1;
    //     });
    //   }, 1000);

    //   return () => {
    //     socket.off("nightTime", { lobbyId, isCreator }); // Remove nightTime listener
    //     socket.off("dayTime", { lobbyId, isCreator }); // Remove dayTime listener
    //     clearInterval(timer); // Clear interval when the component is unmounted or timer stops
    //   };
    // }, [isRunning, isRestarting, isCreator, socket, lobbyId]);

  // useEffect(() => {
  //   if (!isRunning || isRestarting) return;
  
  //   const timer = setInterval(() => {
  //     setSeconds((prev) => {
  //       if (prev === 1) { 
  //         clearInterval(timer);
  
  //         setIsNightMode((prevMode) => {
  //           const newMode = !prevMode;
            
  //           if (newMode) {
  //             socket.emit("nightTime", { lobbyId }); // 🔹 Emit only when switching to night mode
  //           }
            
  //           return newMode;
  //         });
  
  //         setTimeout(() => {
  //           setSeconds(10); // Restart timer (change to 60 in actual game)
  //           setIsRestarting(true);
  //         }, 1000); 
  
  //         return 0;
  //       }
  //       return prev - 1;
  //     });
  //   }, 1000);
  
  //   return () => clearInterval(timer);
  // }, [isRunning, isRestarting, socket, lobbyId]);

  useEffect(() => {
    if (isRestarting) {
      setIsRestarting(false); // Reset restart flag after timer is set to new value
    }
  }, [isRestarting]);

  // 6. Set Night Mode
  // const handleChangeToNight = () => {
  //   setIsNightMode(true);
  // };

  // 7. Handle Sending Messages
  const handleSendMessage = () => {
    if (message.trim()) {
      socket.emit("sendMessage", {
        lobbyId,
        text: message.trim(),
      });
      setMessage("");
    }
  };

  // 8. Handle "Enter" Key Press
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 9. Go back to home
  const handleBackToHome = () => {
    navigate("/");
  };

  return (
    <div className={`chatroom-container ${isNightMode ? "chatroom-container-night" : ""}`}>
      {/* Header */}
      <div className={`chatroom-header ${isNightMode ? "chatroom-header-night" : ""}`}>
        <h2>Chatroom</h2>
        <button className={`back-button ${isNightMode ? "back-button-night" : ""}`} onClick={handleBackToHome}>
          Back to Home
        </button>
        <div className="timer">
          {Math.floor(seconds / 60)}:{seconds % 60 < 10 ? `0${seconds % 60}` : seconds % 60}
        </div>
      </div>

      {/* Messages Display */}
      <div className={`chatroom-messages ${isNightMode ? "chatroom-messages-night" : ""}`}>
        {messages.map((msg, idx) => (
          <div key={idx} className="chatroom-message">
            <span className={`chatroom-timestamp ${isNightMode ? "chatroom-timestamp-night" : ""}`}>
              {new Date(msg.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>{" "}
            <span className={`chatroom-username ${isNightMode ? "chatroom-username-night" : ""}`}>
              {msg.sender}:
            </span>{" "}
            <span className="chatroom-text">{msg.text}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Container */}

      {!isNightMode && (
        <div className="chatroom-input-container">
          <textarea
            className="chatroom-input"
            rows="2"
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
          />
          <button className="chatroom-send-button" onClick={handleSendMessage}>Send</button>
        </div>
      )}
    </div>
      //   /{/* <div className={`chatroom-input-container ${isNightMode ? 'hidden' : ''}`}>
      //     <textarea
      //       className="chatroom-input"
      //       rows="2"
      //       placeholder="Type your message..."
      //       value={message}
      //       onChange={(e) => setMessage(e.target.value)}
      //       onKeyDown={handleKeyPress}
      //     />
      //     <button className={`chatroom-send-button ${isNightMode ? "chatroom-send-button-night" : ""}`}  onClick={handleSendMessage}>
      //       Send
      //     </button>
      //   </div>
      // </div> */}
  );
};

export default ChatroomPage;