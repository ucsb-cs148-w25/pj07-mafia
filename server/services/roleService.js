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

/**
 * Determines the roles based on the number of players.
 * Only includes Mafia, Detective, Doctor, and Villagers.
 * @param {number} playerCount 
 * @returns {array} - Array of role strings.
 */
function determineRoles(playerCount) {
  if (playerCount < 6 || playerCount > 20) {
    throw new Error('Player count must be between 6 and 20.');
  }

  const roles = [];

  // Assign Mafia: 1 Mafia for 6-9 players, scaling to 5 Mafia for 20 players
  let mafiaCount = 1; // Default for 6-9 players
  if (playerCount >= 10 && playerCount < 15) {
    mafiaCount = 2;
  } else if (playerCount >= 15 && playerCount < 20) {
    mafiaCount = 3;
  } else if (playerCount === 20) {
    mafiaCount = 5;
  }
  roles.push(...Array(mafiaCount).fill('Mafia'));

  // Assign Detective: 1 Detective for 6-10 players, scaling to 2 for 11-20 players
  let detectiveCount = 1;
  if (playerCount >= 11) {
    detectiveCount = 2;
  }
  roles.push(...Array(detectiveCount).fill('Detective'));

  // Assign Doctor: 1 Doctor for 6-10 players, scaling to 2 for 11-20 players
  let doctorCount = 1;
  if (playerCount >= 11) {
    doctorCount = 2;
  }
  roles.push(...Array(doctorCount).fill('Doctor'));

  // Fill the rest with Villagers
  const totalAssigned = roles.length;
  const villagersCount = playerCount - totalAssigned;
  roles.push(...Array(villagersCount).fill('Villager'));

  return roles;
}

/**
 * Shuffles an array in place using Fisher-Yates algorithm.
 * @param {array} array 
 * @returns {array} - Shuffled array.
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Assigns roles to players in a lobby.
 * @param {string} lobbyId 
 */
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