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

  // Handle vote acknowledgment and voting complete events
  useEffect(() => {
    const handleVoteComplete = () => {
      console.log("[VOTING] Closing popup as voting is complete.");
      if (typeof onClose === "function") {
        onClose();
      }
    };
    
    const handleVoteAcknowledged = (data) => {
      console.log("[VOTING] Vote acknowledged:", data);
      if (typeof onClose === "function") {
        onClose();
      }
    };
    
    socket.on("voting_complete", handleVoteComplete);
    socket.on("vote_acknowledged", handleVoteAcknowledged);
    
    return () => {
      socket.off("voting_complete", handleVoteComplete);
      socket.off("vote_acknowledged", handleVoteAcknowledged);
    };
  }, [onClose]);

  // Debug: Log the players list received.
  useEffect(() => {
    console.log("[DEBUG POPUP] Received players list in VotingPopup:", players);
    console.log("[DEBUG POPUP] Current role in VotingPopup:", role);
  }, [players, role]);

  const filteredPlayers = players.slice(0)

  return (
    <div className="voting-popup">
      <h3>
        {role === "Mafia" ? "KILL" : 
         role === "Doctor" ? "SAVE" :
         role === "Detective" ? "INVESTIGATE" : "VOTE"}
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
            console.log(`[VOTING] Submitting vote as ${role} for ${selectedPlayer}`);
            setVoteSubmitted(true);
            
            // Let the parent component handle voting
            if (typeof onVote === "function") {
              onVote(selectedPlayer);
            }
          }
        }}
        disabled={voteSubmitted || !selectedPlayer}
      >
        Submit Vote
      </button>

      <button 
        onClick={() => {
          console.log('[VOTING] Canceling vote');
          
          // Let the parent component handle close
          if (typeof onClose === "function") {
            onClose();
          }
        }} 
        disabled={voteSubmitted}>
        Cancel
      </button>
    </div>
  );
};

export default VotingPopup;
