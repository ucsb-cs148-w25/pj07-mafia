import React from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();

  const startGame = () => {
    navigate('/gameover');
  };

  return (
    <div className="home">
      <h1>Welcome to the Game!</h1>
      <button onClick={startGame} className="start-button">
        Start Game
      </button>
    </div>
  );
}

export default Home;
