import React from 'react';
import { useNavigate } from 'react-router-dom';

function HomePage() {
  const navigate = useNavigate();

  // Inline styles for a simple gradient background and centered content
  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #e66465, #9198e5)', // nice gradient
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    textAlign: 'center',
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

  const buttonContainerStyle = {
    display: 'flex',
    gap: '1rem',
  };

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

  // "Create Lobby" navigates to /lobby (no ID) => the LobbyPage will create a new one
  const handleCreateLobby = () => {
    let lobbyID = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < 4) {
      lobbyID += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    navigate(`/lobby/${lobbyID}`);
  };

  // "Join Lobby" prompts for an ID => navigates to /lobby/:id => the LobbyPage joins that lobby
  const handleJoinLobby = () => {
    const code = prompt('Enter Lobby ID:');
    if (code) {
      navigate(`/lobby/${code}`);
    }
  };

  // Navigate to the chatroom
  const handleGoToChatroom = () => {
    navigate('/chatroom');
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
        <button
          style={buttonStyle}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#555')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#333')}
          onClick={handleGoToChatroom}
        >
          Chatroom
        </button>
      </div>
    </div>
  );
}

export default HomePage;
