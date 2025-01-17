import React from 'react';
import { useNavigate } from 'react-router-dom';

function GameOver() {
  const navigate = useNavigate();

  const goBack = () => {
    navigate('/');
  };

  return (
    <div className="game-over">
      <h1>Game Over</h1>
      <p>Thanks for playing!</p>
      <button onClick={goBack} className="play-again-button">
        Play Again
      </button>
    </div>
  );
}

export default GameOver;
