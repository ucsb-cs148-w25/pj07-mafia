import axios from 'axios';
import { config } from './config.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const apiKey = config.ANTHROPIC_API_KEY;

console.log("API Key loaded:", apiKey ? 'Yes' : 'No');

export const rewriteMessage = async (message, instructions = "Rewrite the message while preserving the original tone, style, and level of formality. Maintain any slang, abbreviations, or casual phrasing exactly as they are, ensuring the rewritten version feels natural and authentic. Do not introduce outdated or unnatural slang. Keep capitalization, punctuation, and sentence structure as close to the original as possible while improving clarity if needed.") => {
    console.log("Using API Key:", apiKey);
  
    if (!apiKey) {
        throw new Error("API Key is missing. Please check your .env configuration.");
    }

    try {
        const prompt = `Instructions: ${instructions}\nMessage: "${message}".\nReword and simply send it back with the changes, no quotes.`;

        const response = await axios.post(
            ANTHROPIC_API_URL,
            {
                model: 'claude-3-5-haiku-20241022',
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
        console.error("Detailed Claude API Error:", error.response?.data || error.message);
        throw error;
    }
};

export const genResponse = async (conversationText, eliminatedPlayerName) => {
    // instructions to tune
    const instructions = `You are ${eliminatedPlayerName}. Given the following conversation log, generate a message that fits the context of the conversation. Keep your tone consistent with your previous messages as ${eliminatedPlayerName}.`;
    console.log(`[AI] Triggered genResonpose for ${eliminatedPlayerName}, given conversation:\n${conversationText}`)
    try {
      const prompt = `Instructions: ${instructions}\nConversation: "${conversationText}".\nGenerate a response as ${eliminatedPlayerName} without using quotes.`;
      
      const response = await axios.post(
        ANTHROPIC_API_URL,
        {
          model: 'claude-3-5-haiku-20241022',
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
      console.error("Error in genResponse:", error.response?.data || error.message);
      throw error;
    }
  };
