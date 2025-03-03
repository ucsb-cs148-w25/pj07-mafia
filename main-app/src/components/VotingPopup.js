import React, { useState, useEffect } from "react";
import socket from "../service/socket";
import "../styles/VotingPopup.css";

const VotingPopup = ({
  players = [],
  onClose = () => {},
  onVote,
  role,
  username,
  lobbyId
}) => {
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [voteSubmitted, setVoteSubmitted] = useState(false);

  // Close the popup when the voting_complete event is received,
  // but only for the voting type that matches this popup
  useEffect(() => {
    const handleVoteComplete = (result) => {
      console.log("[VOTING] Received voting_complete event", result);
      
      // During night phase, night role popups close only when night phase ends
      if (role === "Mafia" || role === "Doctor" || role === "Detective") {
        // We'll let the phase change close these popups instead
        if (result && result.type && result.type === "mafia") {
          console.log("[VOTING] Closing night role popup as night phase ended");
          if (typeof onClose === "function") {
            onClose();
          }
        }
      } else {
        // For villager votes, close immediately on vote complete
        console.log("[VOTING] Closing daytime voting popup");
        if (typeof onClose === "function") {
          onClose();
        }
      }
    };
    
    socket.on("voting_complete", handleVoteComplete);
    return () => {
      socket.off("voting_complete", handleVoteComplete);
    };
  }, [onClose, role]);

  // Debug: Log the players list received.
  useEffect(() => {
    console.log("[DEBUG POPUP] Received players list in VotingPopup:", players);
  }, [players]);

  const filteredPlayers = players

  // Get the appropriate action text based on role
  const getActionText = () => {
    switch(role) {
      case "Mafia":
        return "KILL";
      case "Doctor":
        return "SAVE";
      case "Detective":
        return "INVESTIGATE";
      default:
        return "VOTE";
    }
  };

  // Get the appropriate prompt text based on role
  const getPromptText = () => {
    switch(role) {
      case "Mafia":
        return "Select a player to eliminate:";
      case "Doctor":
        return "Select a player to save:";
      case "Detective":
        return "Select a player to investigate:";
      default:
        return "Vote to eliminate:";
    }
  };

  return (
    <div className="voting-popup">
      <h3>
        {getActionText()}
      </h3>
      
      <p>{getPromptText()}</p>

      <select
        value={selectedPlayer}
        onChange={(e) => setSelectedPlayer(e.target.value)}
        disabled={voteSubmitted}
      >
        <option value="" disabled>
          Select a player
        </option>
        {filteredPlayers.length > 0 ? (
          filteredPlayers.map((player) => (
            <option key={player} value={player}>
              {player}
            </option>
          ))
        ) : (
          <option disabled>No other players available</option>
        )}
      </select>

      <button
        onClick={() => {
          if (selectedPlayer) {
            console.log(`[VOTING] ${role} vote submitted for ${selectedPlayer}`);
            setVoteSubmitted(true);
            // Delegate vote submission to the parent component.
            if (typeof onVote === "function") {
              onVote(selectedPlayer);
            }
          }
        }}
        disabled={voteSubmitted || !selectedPlayer}
      >
        Submit
      </button>

      <button onClick={onClose} disabled={voteSubmitted}>
        Cancel
      </button>
    </div>
  );
};

export default VotingPopup;