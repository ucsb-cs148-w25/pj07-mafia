import React from "react";
import "../styles/WinnerPopup.css";

const WinnerPopup = ({ winner, onClose }) => {
  return (
    <div className="winner-popup-overlay">
      <div className="winner-popup-modal">
        <h2>Game Over</h2>
        <p>{winner.toUpperCase()} wins the game!</p>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default WinnerPopup;
