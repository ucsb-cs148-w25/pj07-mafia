import React from "react";
import "../styles/WinnerPopup.css";

import winMafia from "../images/mafia-win.png";
import winVillager from "../images/villager-win.png";

const WinnerPopup = ({ winner, onClose, phase }) => {
  return (
    <div className={`winner-popup-overlay ${phase === "night" ? "night" : ""}`}>
      <div className="winner-popup-modal">
        <img src={winner === "mafia" ? winMafia : winVillager} 
             alt={`${winner} win`} 
             className={winner === "mafia" ? "mafia-win" : "villager-win"} />
        <p>{winner.toUpperCase()} wins the game!</p>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default WinnerPopup;
