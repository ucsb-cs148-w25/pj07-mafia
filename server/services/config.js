// config.js (CommonJS version)
const path = require('path');
const dotenv = require('dotenv');

// By default in CommonJS, __dirname is available
dotenv.config({
  path: path.resolve(__dirname, '../../.env')
});

// We export an object called config
const config = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
};

module.exports = { config };