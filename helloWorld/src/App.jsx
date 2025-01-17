// App.jsx
import React, { useState } from "react";
import "./App.css";

function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const handleStartGame = () => {
    setGameStarted(true);
  };

  const handleSendMessage = () => {
    if (input.trim() !== "") {
      setMessages([...messages, input]);
      setInput("");
    }
  };

  return (
    <div className="container">
      {!gameStarted ? (
        <button onClick={handleStartGame}>Start Game</button>
      ) : (
        <div>
          <div className="chat-box">
            {messages.map((message, index) => (
              <div key={index}>{message}</div>
            ))}
          </div>
          <div className="input-container">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
            />
            <button onClick={handleSendMessage}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
