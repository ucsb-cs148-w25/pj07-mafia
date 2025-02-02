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

  // Close the popup when the voting_complete event is received.
  useEffect(() => {
    const handleVoteComplete = () => {
      console.log("[VOTING] Closing popup as voting is complete.");
      if (typeof onClose === "function") {
        onClose();
      }
    };
    socket.on("voting_complete", handleVoteComplete);
    return () => {
      socket.off("voting_complete", handleVoteComplete);
    };
  }, [onClose]);

  // Debug: Log the players list received.
  useEffect(() => {
    console.log("[DEBUG POPUP] Received players list in VotingPopup:", players);
  }, [players]);

  // Filter out the current user
  const filteredPlayers = players.filter(
    (player) => String(player) !== String(username)
  );

  return (
    <div className="voting-popup">
      <h3>
        {role === "Mafia" ? "Mafia Kill (Night)" : "Villager Vote (Day)"}
      </h3>

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
            console.log(`[VOTING] Vote submitted for ${selectedPlayer}`);
            setVoteSubmitted(true);
            // Delegate vote submission to the parent component.
            if (typeof onVote === "function") {
              onVote(selectedPlayer);
            }
          }
        }}
        disabled={voteSubmitted || !selectedPlayer}
      >
        Submit Vote
      </button>

      <button onClick={onClose} disabled={voteSubmitted}>
        Cancel
      </button>
    </div>
  );
};

export default VotingPopup;