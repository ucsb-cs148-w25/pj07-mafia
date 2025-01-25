import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

function LobbyPage() {
  const { lobbyId: routeLobbyId } = useParams(); // read the :lobbyId param from the URL
  const navigate = useNavigate();
  
  const [socket, setSocket] = useState(null);
  const [lobbyId, setLobbyId] = useState(routeLobbyId || '');
  const [players, setPlayers] = useState([]);
  const [isGameReady, setIsGameReady] = useState(false);

  // Connect to the server once when the component mounts
  useEffect(() => {
    const newSocket = io('http://localhost:4000'); // your server’s address
    setSocket(newSocket);

    // Cleanup
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Listen for events from the server
  useEffect(() => {
    if (!socket) return;

    socket.on('lobbyCreated', (data) => {
      setLobbyId(data.lobbyId);
      setPlayers(data.players);
      console.log('Lobby created with ID:', data.lobbyId);
    });

    socket.on('lobbyUpdated', (data) => {
      setPlayers(data.players);
    });

    socket.on('lobbyError', (err) => {
      alert(err.message);
      navigate('/'); // go back to home if there's an error
    });

    socket.on('startGame', (data) => {
      console.log('Ready to start game!');
      setIsGameReady(true);
    });

    // socket.on('startChatroom', () => {
    //   console.log('Lobby started! Navigating to chatroom...');
    //   navigate('/chatroom');
    // });
  }, [socket, navigate]);

  // Decide whether to create or join a lobby (based on URL param)
  useEffect(() => {
    if (!socket) return;

    if (routeLobbyId) {
      // If there's a lobby ID in the URL, join that lobby
      socket.emit('joinLobby', routeLobbyId);
    } else {
      // Otherwise create a new one
      socket.emit('createLobby');
    }
  }, [routeLobbyId, socket]);

  // Some basic inline styling
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

  const startButtonStyle = {
    marginTop: '20px',
    marginRight: '10px',
    padding: '0.5rem 1rem',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#333',
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
    backgroundColor: '#333',
    color: '#fff',
    fontSize: '1rem',
    cursor: 'pointer',
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  const handleStartGame = () => {
    navigate('/chatroom');
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={headingStyle}>Lobby Page</h2>
        
        {lobbyId && (
          <p>
            <strong>Lobby ID:</strong> {lobbyId}
          </p>
        )}

        <h3>Players in Lobby:</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0' }}>
          {players.map((player) => (
            <li
              key={player}
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

        {isGameReady && (
        <button style={startButtonStyle} onClick={handleStartGame}>
          Start Game
        </button>
      )}

        <button style={backButtonStyle} onClick={handleBackToHome}>
          Back to Home
        </button>
      </div>
    </div>
  );
}

export default LobbyPage;
