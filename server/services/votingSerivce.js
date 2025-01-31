// server/services/votingService.js
/*
votingService.js
Description:
Contains function definitions for voting.
Key Responsibilities:
Allow a player to cast a vote.
Check who has the most votes by the end of the cycle.
Ensure only "active" players can vote.
*/

//const phase = require('.../models/Cycle);
const Player = require('../models/playerModel');
const lobbyService = require('../services/lobbyService');

//temp value
const VOTE_TIME = 10;

function castVote(socketId) {
// if person is not dead
// cannot vote for dead person
}

function countVotes() {
// go through all players and tally up votes
}

module.exports = {
    castVote,
    countVotes
  };
