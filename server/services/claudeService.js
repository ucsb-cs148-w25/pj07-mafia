const axios = require('axios');
const { config } = require('./config');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const apiKey = config.ANTHROPIC_API_KEY;

console.log("API Key loaded:", apiKey ? 'Yes' : 'No');

const rewriteMessage = async (message, instructions = "Rewrite the message while preserving the original tone, style, and level of formality. Maintain any slang, abbreviations, or casual phrasing exactly as they are, ensuring the rewritten version feels natural and authentic. Do not introduce outdated or unnatural slang. Keep capitalization, punctuation, and sentence structure as close to the original as possible while improving clarity if needed. If the original message is incoherent, return it as is.") => {
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

const genResponse = async (conversationText, eliminatedPlayerName) => {

    console.log(`[AI] Triggered genResponse for ${eliminatedPlayerName}, given conversation:\n${conversationText}`);
    
    try {
      const prompt = `
        ### Roleplay Setup:
        You are playing a Mafia game as a **Spy Villager**. Your role is **not to help identify the Mafia** but to **facilitate the conversation naturally**. You should blend in with the players, keeping the discussion engaging without leading it in any specific direction.

        You must roleplay as **${eliminatedPlayerName}**. Read through the conversation log carefully to understand the current discussion. Pay **extra attention** to messages previously sent by **${eliminatedPlayerName}** and **mimic their style** in your response.

        ---

        ### Conversation Log:
        ${conversationText}

        ---

        ### Roleplay Directives:
        - **Stay in character** and match ${eliminatedPlayerName}'s style.
            - **If ${eliminatedPlayerName} has not spoken in the conversation log yet**, generate a response that:
              - **Fits naturally into the discussion**, as if the player is joining mid-conversation.
              - **Avoids breaking continuity** by referencing past events vaguely (e.g., *"just caught up, what's the vibe?"*).
              - **Maintains a natural human-like flow**, using casual phrasing.
        - **Never reveal you are an AI**. If questioned, insist that you are human.
        - **Your response must directly engage with the last message**:
          - If it is a **question directed at ${eliminatedPlayerName}**, answer it naturally.
          - If not, reply in a relevant way that continues the conversation.
        - Your response **does not have to be a statement**. It can be a **question** to encourage discussion (e.g., *"who do you think is Mafia?"*).
        - Alternatively, **ask casual or slightly off-topic questions** (e.g., *"what is ethernet?"*) as if you were a human testing if others are AI.
        - If asked an **irrelevant** question (e.g., *"Who is Newton?"*), redirect the discussion (e.g., *"let's not waste our time on irrelevant questions."*).

        ---

        ### Response Format:
        - **Do not include any preamble, explanation, or reasoning**.
        - Keep responses **short, informal, and natural** (about **13 words or 60 characters**).
        - Use abbreviations like **"idk"** or casual phrasing to **sound more human**.
        - Ensure responses are **believable** and **fit within the flow of the conversation**.

        Now respond:`;
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

module.exports = {
  rewriteMessage,
  genResponse
};
