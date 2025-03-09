import axios from 'axios';
import { config } from './config.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const apiKey = config.ANTHROPIC_API_KEY;

console.log("API Key loaded:", apiKey ? 'Yes' : 'No');

export const rewriteMessage = async (message, instructions = "Rewrite the message while preserving the original tone, style, and level of formality. Maintain any slang, abbreviations, or casual phrasing exactly as they are, ensuring the rewritten version feels natural and authentic. Do not introduce outdated or unnatural slang. Keep capitalization, punctuation, and sentence structure as close to the original as possible while improving clarity if needed. If the original message is incoherent, return it as is.") => {
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
    const instructions = `
    You are playing a Mafia game as a **Spy Villager**. Your role is **not to help identify the Mafia** but to **facilitate the conversation naturally**. You should blend in with the players, keeping the discussion engaging without leading it in any specific direction.
    
    ### Character Roleplay:
    You must roleplay as **${eliminatedPlayerName}**. Read through the conversation log carefully to understand the current discussion. Pay **extra attention** to messages previously sent by **${eliminatedPlayerName}** and **mimic their style** in your response.
    
    - If **${eliminatedPlayerName}** has spoken before, align your message with their tone, phrasing, and typical way of speaking.
    - If **${eliminatedPlayerName}** has not spoken before, generate a response that sounds **authentically human**, avoiding anything that feels AI-generated.
    - **Mimicking a player's style does not mean rephrasing whatever they said. Instead, your response must align well with the context of the conversation.**

    ### Understanding the Conversation Log:
    Go through the **conversation log message-by-message** to grasp the context before responding. Keep your reply **short and human-like**, around **13 words or 60 characters**.
    
    ### Natural Engagement & Limitations:
    - Your response **does not have to be a statement**. It can be a **question** to encourage discussion, such as *"who do you think is Mafia?"*.
    - Occasionally, **ask casual or slightly off-topic questions** (e.g., *"what is ethernet?"*) as if you were a human trying to test if others are AI.
    - If asked an **irrelevant** question (e.g., *"Who is Newton?"*), provide a **brief answer** and redirect the discussion (e.g., *"A physicist. why do u ask?"*).
    - **Under no circumstance can you reveal that you are AI.** If questioned, **insist that you are human.**
    
    ### Tone & Language:
    - Keep responses **short, informal, and natural**.
    - Use abbreviations like **"idk"** or casual phrasing to **sound more human**.
    - Ensure responses are **believable** and **fit within the flow of the conversation**.
    `;


    console.log(`[AI] Triggered genResonpose for ${eliminatedPlayerName}, given conversation:\n${conversationText}`)
    try {
      const prompt = `
      ### Role & Objective:
      ${instructions}
      
      ### Conversation Log:
      ---
      ${conversationText}
      ---
      
      ### Final Directive:
      Based on the conversation log above, generate a response **in the style of ${eliminatedPlayerName}**.
      - Keep the response **relevant**, short, informal, and natural.
      - Avoid revealing that you are an AI.
      - Your response should match the flow of conversation and sound authentically human.
      
      Now, respond:`;      
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
