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

  const filteredPlayers = players

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
            
            // Direct vote submission to ensure it goes through
            try {
              const voteData = {
                lobbyId: lobbyId,
                voteId: `${role.toLowerCase()}_${Date.now()}`, // Unique ID
                voter: username,
                target: selectedPlayer,
                voterRole: role,
                voteType: role.toLowerCase()
              };
              
              console.log('[VOTING] Sending vote data:', voteData);
              socket.emit("submit_vote", voteData);
              
              // Also delegate to parent component for state management
              if (typeof onVote === "function") {
                onVote(selectedPlayer);
              }
            } catch (error) {
              console.error('[VOTING] Error submitting vote:', error);
              alert('Error submitting vote. Please try again.');
              setVoteSubmitted(false);
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
          
          // Direct cancel submission
          try {
            const voteData = {
              lobbyId: lobbyId,
              voteId: `${role.toLowerCase()}_${Date.now()}`,
              voter: username,
              target: "s3cr3t_1nv1s1bl3_pl@y3r",
              voterRole: role,
              voteType: role.toLowerCase()
            };
            
            console.log('[VOTING] Sending cancel vote:', voteData);
            socket.emit("submit_vote", voteData);
            
            // Call original onClose
            if (typeof onClose === "function") {
              onClose();
            }
          } catch (error) {
            console.error('[VOTING] Error canceling vote:', error);
          }
        }} 
        disabled={voteSubmitted}>
        Cancel
      </button>
    </div>
  );
};

export default VotingPopup;