// HomePage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import "../styles/HomePage.css";

function HomePage() {
  const navigate = useNavigate();
  const [showInstructions, setShowInstructions] = useState(false);

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
        <h1 className="home-title">dystopAI</h1>
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

        <div className="instructions-button-container">
          <button className="home-button" onClick={() => setShowInstructions(true)}>
            Instructions
          </button>
        </div>
      </div>

      {showInstructions && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>dystopAI Rules</h2>
            <p>
              Mafia is a game of deception and strategy. Each round is split into two phases: 
              <strong> Night</strong> and <strong> Day</strong>.
            </p>
            <p>
              During the <strong>Night</strong>:
            </p>
            <ul>
              <li>
                <strong>Doctor:</strong> Chooses a player to protect. If the targeted player is attacked by the Mafia, they are saved.
              </li>
              <li>
                <strong>Mafia:</strong> Collaborate secretly to select a target to eliminate. Their goal is to outnumber the remaining players.
              </li>
              <li>
                <strong>Investigator:</strong> Investigates one player per night to determine if they are part of the Mafia.
              </li>
              <li>
                <strong>Normal Villager:</strong> Has no special abilities at night, but is essential during the day to help identify and eliminate Mafia members.
              </li>
            </ul>
            <p>
              During the <strong>Day</strong>, all players come together to discuss suspicions and vote on who they believe is a Mafia member.
              The player with the most votes is eliminated. The game continues until either the Mafia outnumber the villagers, or all Mafia members are eliminated.
            </p>
            <div className="button-wrapper"> {/* The wrapper div */}
              <button className="close-button" onClick={() => setShowInstructions(false)}>
              Return to Home
            </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;