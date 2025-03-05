import axios from 'axios';
import { config } from './config.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const apiKey = config.ANTHROPIC_API_KEY;

console.log("API Key loaded:", apiKey ? 'Yes' : 'No');

export const rewriteMessage = async (message) => {
    console.log("Using API Key:", apiKey);
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your .env configuration.");
  }

  try {
    const prompt = `Please reword this message: "${message}". Simply send it back with the changes and no quotations.`;

    const response = await axios.post(
      ANTHROPIC_API_URL,
      {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
          'Anthropic-Version': '2023-06-01',
        },
      }
    );

    return response.data.content[0].text;
  } catch (error) {
    console.error("Detailed Claude API Error:", 
      error.response?.data || error.message
    );
    throw error;
  }
};