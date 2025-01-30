/*
RoleService.js
Description:
Handles role assignment and management during the game.
Key Responsibilities:
Assign roles (e.g., Mafia, Villager) based on player count.
Ensure balanced role distribution.
Provide role-specific logic (e.g., Mafia actions).

*/

const { getLobby } = require('./lobbyService');

function determineRoles(playerCount) {
  const roles = [];
  // Example distribution (adjust according to your game rules):
  const mafiaCount = Math.max(1, Math.floor(playerCount * 0.25));
  const specialRoles = ['Detective', 'Doctor'].slice(0, Math.floor(playerCount/5));

  roles.push(...Array(mafiaCount).fill('Mafia'));
  roles.push(...specialRoles);
  roles.push(...Array(playerCount - roles.length).fill('Villager'));

  return roles;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function assignRoles(lobbyId) {
    const lobby = getLobby(lobbyId);
    if (!lobby) throw new Error('Lobby not found');
    
    const roles = determineRoles(lobby.players.length);
    console.log('[DEBUG] Base roles:', roles); // Log initial role list
    
    const shuffledRoles = shuffleArray([...roles]); // Clone array for shuffle
    console.log('[DEBUG] Shuffled roles:', shuffledRoles); // Log shuffled roles
    
    lobby.players.forEach((player, index) => {
      player.role = shuffledRoles[index];
      console.log(`[DEBUG] Assigned ${player.username} (${player.socketId}) as ${player.role}`);
    });
  
    // Add verification log
    console.log('[DEBUG] Final role distribution:');
    lobby.players.forEach(player => {
      console.log(`- ${player.username}: ${player.role}`);
    });
  }
module.exports = { assignRoles };