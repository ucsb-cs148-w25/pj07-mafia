// server/controllers/lobbyController.js

const express = require('express');
const router = express.Router();

/**
 * In the future, if you want REST endpoints for:
 * - Listing lobbies
 * - Fetching a single lobby's info
 * - Creating a lobby via HTTP request
 * 
 * You can do so here. For now, it's a placeholder.
 */

// Example: GET /api/lobby/test
router.get('/test', (req, res) => {
  return res.json({ message: 'Lobby Controller Placeholder' });
});

// Export the router
module.exports = router;
