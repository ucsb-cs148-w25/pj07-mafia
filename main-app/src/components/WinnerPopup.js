import React from "react";
import "../styles/WinnerPopup.css";

import winMafia from "../images/mafia-win.png";
import winVillager from "../images/villager-night.png";

const WinnerPopup = ({ winner, onClose }) => {
  return (
    <div className="winner-popup-overlay">
      <div className="winner-popup-modal">
        <img src={winMafia} alt="Mafia win" />
        <p>{winner.toUpperCase()} wins the game!</p>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default WinnerPopup;
