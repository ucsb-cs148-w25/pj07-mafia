import React from 'react';
import { useNavigate } from 'react-router-dom';
import "../styles/HomePage.css";

function HomePage() {
  const navigate = useNavigate();

  // Handlers for navigation
  const handleCreateLobby = () => {
    navigate('/lobby');
  };

  const handleJoinLobby = () => {
    const code = prompt('Enter Lobby ID:');
    if (code) {
      navigate(`/lobby/${code}`);
    }
  };

  return (
    <div className="home-container">
      <div className="home-card">
        <h1 className="home-title">Welcome to the Mafia Game</h1>
        <p className="home-subtitle">
          Gather your friends and dive into a world of deception and strategy.
        </p>
        <div className="home-button-container">
          <button className="home-button home-create" onClick={handleCreateLobby}>
            Create Lobby
          </button>
          <button className="home-button home-join" onClick={handleJoinLobby}>
            Join Lobby
          </button>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
