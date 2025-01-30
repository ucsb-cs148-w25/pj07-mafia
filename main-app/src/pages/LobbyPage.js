import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "../service/socket";
import "../styles/LobbyPage.css"; // Import your CSS

function LobbyPage() {
  const { lobbyId: routeLobbyId } = useParams();
  const navigate = useNavigate();

  // Store an array of players as: [{ id, name }, ...]
  const [players, setPlayers] = useState([]);
  const [lobbyId, setLobbyId] = useState(routeLobbyId || "");
  const [isGameReady, setIsGameReady] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [username, setUsername] = useState("");
  const [isUsernameSet, setIsUsernameSet] = useState(false);

  // Listen for lobby-related events
  useEffect(() => {
    if (!socket) return;

    // 1. Lobby Created
    socket.on("lobbyCreated", (data) => {
      setLobbyId(data.lobbyId);
      setPlayers(data.players);
      setIsCreator(data.isCreator || false);
    });

    // 2. Lobby Updated
    socket.on("lobbyUpdated", (data) => {
      setPlayers(data.players);
    });

    // 3. Lobby Ready
    socket.on("lobbyReady", (data) => {
      if (data.players) {
        setPlayers(data.players);
      }
      setIsGameReady(true);
    });

    // 4. Lobby Error
    socket.on("lobbyError", (err) => {
      alert(err.message);
      navigate("/");
    });

    // 5. Creator Assigned
    socket.on("creatorAssigned", (data) => {
      alert(data.message);
      setIsCreator(true);
    });

    // 6. Start Chatroom
    socket.on("startChatroom", (data) => {
      // data.lobbyId could be used, but we already have lobbyId in state
      navigate(`/chatroom/${lobbyId}`);
    });

    // Cleanup event listeners on unmount
    return () => {
      socket.off("lobbyCreated");
      socket.off("lobbyUpdated");
      socket.off("lobbyReady");
      socket.off("lobbyError");
      socket.off("creatorAssigned");
      socket.off("startChatroom");
    };
  }, [socket, navigate, lobbyId, isCreator]);

  // Decide whether to create or join a lobby after username is set
  useEffect(() => {
    if (!socket || !isUsernameSet) return;

    if (routeLobbyId) {
      // If there's a lobby ID in the URL, join that lobby
      socket.emit("joinLobby", { lobbyId: routeLobbyId, username });
    } else {
      // Otherwise, create a new lobby
      socket.emit("createLobby", username);
    }
  }, [routeLobbyId, socket, username, isUsernameSet]);

  // Handlers
  const handleBackToHome = () => {
    navigate("/");
  };

  const handleStartGame = () => {
    if (socket && lobbyId) {
      socket.emit("startGame", {lobbyId, isCreator});
    }
  };

  const handleUsernameSubmit = (e) => {
    e.preventDefault();
    if (username.trim() !== "") {
      setIsUsernameSet(true);
      localStorage.setItem("username", username.trim());
    } else {
      alert("Please enter a valid username.");
    }
  };

  return (
    <div className="lobby-container">
      <div className="lobby-card">
        {!isUsernameSet ? (
          <>
            <h2 className="lobby-heading">Enter Your Username</h2>
            <form onSubmit={handleUsernameSubmit}>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="lobby-input"
                required
              />
              <br />
              <button type="submit" className="lobby-button lobby-button-join">
                Join Lobby
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="lobby-heading">Lobby Page</h2>

            {lobbyId && (
              <p>
                <strong>Lobby ID:</strong> {lobbyId}
              </p>
            )}

            <h3>Players in Lobby:</h3>
            <ul className="lobby-players-list">
              {players.map((player) => (
                <li key={player.id} className="lobby-player-item">
                  <span role="img" aria-label="player">
                    👤
                  </span>{" "}
                  {player.name}
                </li>
              ))}
            </ul>

            {isCreator && isGameReady && (
              <button
                className="lobby-button lobby-button-start"
                onClick={handleStartGame}
              >
                Start Game
              </button>
            )}

            <button
              className="lobby-button lobby-button-back"
              onClick={handleBackToHome}
            >
              Back to Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default LobbyPage;
