// server/controllers/votingController.js

/*
This controller handles vote handling.
- Day votes
- Mafia votes
- Special role votes(Doctor, Sheriff): Not yet for MVP
- Result calculation
*/
/**
 * Handles voting mechanics
 * Events:
 * - cast_vote
 * - vote_result
 * Responsibilities:
 * - Vote validation
 * - Vote tallying
 * - Result announcement
 * - Vote type management (day/mafia/doctor)
 * - Tie resolution
 */