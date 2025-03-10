const express = require('express');
const { rewriteMessage, genResponse } = require('../services/claudeService'); // Use require instead of import

const router = express.Router();

// Define the POST endpoint to rewrite messages
router.post('/rewrite', async (req, res) => {
  try {
    const { message, instructions } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const rewrittenMessage = await rewriteMessage(message, instructions); // Call the rewriteMessage function
    res.json({ rewrittenMessage }); // Send back the rewritten message
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/genResponse', async (req, res) => {
  try {
    const { conversationText, eliminatedPlayerName } = req.body;
    
    if (!conversationText || !eliminatedPlayerName) {
      return res.status(400).json({ error: 'conversationText and eliminatedPlayerName are required' });
    }
    
    const responseText = await genResponse(conversationText, eliminatedPlayerName);
    res.json({ responseText });
  } catch (error) {
    console.error('Error in /genResponse:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; // Use CommonJS module.exports instead of ES module export default
