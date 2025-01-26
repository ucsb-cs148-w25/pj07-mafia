// main-app/src/components/LobbyPage.js

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../service/socket'; // Corrected import path

function LobbyPage() {
  const { lobbyId: routeLobbyId } = useParams(); // Read the :lobbyId param from the URL
  const navigate = useNavigate();

  const [lobbyId, setLobbyId] = useState(routeLobbyId || '');
  const [players, setPlayers] = useState([]);
  const [isGameReady, setIsGameReady] = useState(false);
  const [isCreator, setIsCreator] = useState(false); // Track if the user is the lobby creator
  const [username, setUsername] = useState(''); // Store the username
  const [isUsernameSet, setIsUsernameSet] = useState(false); // Track if username is set

  // Listen for events from the server
  useEffect(() => {
    if (!socket) return;

    // Handle lobby creation
    socket.on('lobbyCreated', (data) => {
      setLobbyId(data.lobbyId);
      setPlayers(data.players.map((p) => p.name)); // Assuming players have 'name' property
      setIsCreator(data.isCreator || false); // Update creator status
      console.log('Lobby created with ID:', data.lobbyId);
    });

    // Handle lobby updates (e.g., player joined or left)
    socket.on('lobbyUpdated', (data) => {
      setPlayers(data.players.map((p) => p.name));
    });

    // Handle lobby ready state
    socket.on('lobbyReady', (data) => {
      setIsGameReady(true);
      console.log('Lobby is ready to start the game.');
    });

    // Handle errors
    socket.on('lobbyError', (err) => {
      alert(err.message);
      navigate('/'); // Redirect to home if there's an error
    });

    // Handle assignment of creator role
    socket.on('creatorAssigned', (data) => {
      alert(data.message);
      setIsCreator(true);
    });

    // Handle navigation to chatroom with lobbyId
    socket.on('startChatroom', (data) => {
      console.log(data.message);
      navigate(`/chatroom/${lobbyId}`); // Navigate to the chatroom with the specific lobbyId
    });

    // Cleanup event listeners on unmount
    return () => {
      socket.off('lobbyCreated');
      socket.off('lobbyUpdated');
      socket.off('lobbyReady');
      socket.off('lobbyError');
      socket.off('creatorAssigned');
      socket.off('startChatroom');
    };
  }, [socket, navigate, lobbyId]);

  // Decide whether to create or join a lobby after username is set
  useEffect(() => {
    if (!socket || !isUsernameSet) return;

    if (routeLobbyId) {
      // If there's a lobby ID in the URL, join that lobby
      socket.emit('joinLobby', { lobbyId: routeLobbyId, username });
    } else {
      // Otherwise, create a new lobby
      socket.emit('createLobby', username);
    }
  }, [routeLobbyId, socket, username, isUsernameSet]);

  // Inline styling for simplicity (unchanged)
  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #8e9eab, #eef2f3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const cardStyle = {
    backgroundColor: '#fff',
    borderRadius: '8px',
    width: '400px',
    maxWidth: '90%',
    padding: '20px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
    textAlign: 'center',
  };

  const headingStyle = {
    marginBottom: '1rem',
    fontSize: '2rem',
  };

  const inputStyle = {
    padding: '0.5rem',
    width: '80%',
    marginBottom: '1rem',
    borderRadius: '4px',
    border: '1px solid #ccc',
  };

  const buttonStyle = {
    marginTop: '10px',
    padding: '0.5rem 1rem',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#007bff',
    color: '#fff',
    fontSize: '1rem',
    cursor: 'pointer',
  };

  const startButtonStyle = {
    marginTop: '20px',
    marginRight: '10px',
    padding: '0.5rem 1rem',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#28a745',
    color: '#fff',
    fontSize: '1rem',
    cursor: 'pointer',
  };

  const backButtonStyle = {
    marginTop: '20px',
    marginLeft: '10px',
    padding: '0.5rem 1rem',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#dc3545',
    color: '#fff',
    fontSize: '1rem',
    cursor: 'pointer',
  };

  // Handlers
  const handleBackToHome = () => {
    navigate('/');
  };

  const handleStartGame = () => {
    if (socket && lobbyId) {
      socket.emit('startGame', lobbyId);
      // Optionally, disable the button or provide feedback
      console.log('Start game event emitted.');
    }
  };

  const handleUsernameSubmit = (e) => {
    e.preventDefault();
    if (username.trim() !== '') {
      setIsUsernameSet(true);
      // Optionally, store the username in localStorage for persistence
      localStorage.setItem('username', username.trim());
    } else {
      alert('Please enter a valid username.');
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {!isUsernameSet ? (
          <>
            <h2 style={headingStyle}>Enter Your Username</h2>
            <form onSubmit={handleUsernameSubmit}>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={inputStyle}
                required
              />
              <br />
              <button type="submit" style={buttonStyle}>
                Join Lobby
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 style={headingStyle}>Lobby Page</h2>

            {lobbyId && (
              <p>
                <strong>Lobby ID:</strong> {lobbyId}
              </p>
            )}

            <h3>Players in Lobby:</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0' }}>
              {players.map((player, index) => (
                <li
                  key={index}
                  style={{
                    marginBottom: '8px',
                    background: '#f4f4f4',
                    borderRadius: '4px',
                    padding: '5px 10px',
                  }}
                >
                  <span role="img" aria-label="player" style={{ marginRight: '8px' }}>
                    👤
                  </span>
                  {player}
                </li>
              ))}
            </ul>

            {/* Conditionally render "Start Game" button for the lobby creator */}
            {isCreator && isGameReady && (
              <button style={startButtonStyle} onClick={handleStartGame}>
                Start Game
              </button>
            )}

            <button style={backButtonStyle} onClick={handleBackToHome}>
              Back to Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default LobbyPage;
