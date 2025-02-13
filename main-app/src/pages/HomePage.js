import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import "../styles/HomePage.css";

function HomePage() {
  const navigate = useNavigate();
  const [showInstructions, setShowInstructions] = useState(false);

  // Inline styles for the main container with a gradient background
  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #e66465, #9198e5)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    textAlign: 'center',
    padding: '1rem',
    position: 'relative',
  };

  const titleStyle = {
    fontSize: '3rem',
    marginBottom: '0.5rem',
    textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
  };

  const subtitleStyle = {
    fontSize: '1.2rem',
    maxWidth: '600px',
    lineHeight: '1.5',
    marginBottom: '2rem',
  };

  // Container for the lobby buttons
  const buttonContainerStyle = {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
  };

  // Button styling
  const buttonStyle = {
    padding: '1rem 2rem',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#333',
    color: '#fff',
    fontSize: '1.2rem',
    cursor: 'pointer',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
    transition: 'background-color 0.2s',
  };

  // Modal overlay and content styling
  const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const modalContentStyle = {
    background: '#fff',
    padding: '2rem',
    borderRadius: '8px',
    maxWidth: '600px',
    width: '90%',
    color: '#333',
    textAlign: 'left',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  };

  const closeButtonStyle = {
    marginTop: '1rem',
    padding: '0.5rem 1rem',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#333',
    color: '#fff',
    fontSize: '1rem',
    cursor: 'pointer',
  };

  // Handlers for the lobby buttons
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
    <div style={containerStyle}>
      <h1 style={titleStyle}>Welcome to the Mafia Game</h1>
      <p style={subtitleStyle}>
        Gather your friends and dive into a world of deception and strategy.
      </p>
      <div style={buttonContainerStyle}>
        <button
          style={buttonStyle}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#555')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#333')}
          onClick={handleCreateLobby}
        >
          Create Lobby
        </button>
        <button
          style={buttonStyle}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#555')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#333')}
          onClick={handleJoinLobby}
        >
          Join Lobby
        </button>
      </div>

      {/* Instructions button positioned fixed at the bottom center */}
      <div
        style={{
          position: 'fixed',
          bottom: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <button
          style={buttonStyle}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#555')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#333')}
          onClick={() => setShowInstructions(true)}
        >
          Instructions
        </button>
      </div>

      {/* Modal with instructions */}
      {showInstructions && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h2>How to Play Mafia</h2>
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
            <button
              style={closeButtonStyle}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#555')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#333')}
              onClick={() => setShowInstructions(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
