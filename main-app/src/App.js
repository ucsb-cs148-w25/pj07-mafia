import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

function App() {
  const [socket, setSocket] = useState(null);
  const [lobbyId, setLobbyId] = useState('');
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    // Connect to the server (port 4000)
    const newSocket = io('http://localhost:4000');
    setSocket(newSocket);

    // Cleanup on unmount
    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (!socket) return;

    // When we get a "lobbyCreated" event
    socket.on('lobbyCreated', (data) => {
      setLobbyId(data.lobbyId);
      setPlayers(data.players);
      console.log('Lobby created with ID:', data.lobbyId);
    });

    // When a lobby gets updated (someone joins/leaves)
    socket.on('lobbyUpdated', (data) => {
      setPlayers(data.players);
    });

    // If there's an error with the lobby
    socket.on('lobbyError', (err) => {
      alert(err.message);
    });
  }, [socket]);

  const createLobby = () => {
    if (!socket) return;
    socket.emit('createLobby');
  };

  const joinLobby = () => {
    if (!socket) return;
    const code = prompt('Enter lobby ID:');
    if (!code) return;
    socket.emit('joinLobby', code);
    setLobbyId(code);
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>Mafia Lobby</h1>
      <button onClick={createLobby}>Create Lobby</button>
      <button onClick={joinLobby}>Join Lobby</button>
      {lobbyId && (
        <div>
          <h2>Lobby ID: {lobbyId}</h2>
          <p>Players in Lobby:</p>
          <ul>
            {players.map((playerId) => (
              <li key={playerId}>{playerId}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
