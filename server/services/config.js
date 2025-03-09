import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// For ES modules, we need to simulate __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load the .env file
dotenv.config({ 
  path: path.resolve(__dirname, '../../.env') 
});

export const config = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
};