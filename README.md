# Mafia

## About Our Project:
A digital platform for playing Mafia, where LLMs secretly take on player roles, and human players earn bonus points by identifying the AI.

## Team Members

| Name                  | Git ID                  |
|-----------------------|-------------------------|
| Albert Wang           | Kanagawa-okiNamiUra     |
| Priyanka Ballani      | pballani                |
| Hung Khuu             | Hungkhuu04              |
| Tyler Tran            | sherpatran              |
| Shivani Madhan        | shivanimadhan           |
| Victor Prchlik        | vprchlik                |
| Andy Subramanian      | Anteater10              |

## App Type and Tech Stack

App Type: Multiplayer Online Website Game (Mafia with AI Integration)

Tech Stack:

- Frontend: React.js

- Backend: Node.js with Express and Socket.IO

- Database: Firebase Realtime Database (or Firestore)

- AI: OpenAI GPT models for generating AI player behavior

- Hosting: Firebase Hosting (for both frontend and backend)

- Version Control: GitHub

## Detailed Plan
MafAi, the mafia app with AI introduces an innovative twist to the classic social deduction game by incorporating AI players powered by large language models (LLMs). Players can join a game via a website where they are initially matched with all human players. One player is given the role of Mafia and they are able to turn other players into AI. The AI will mimic human conversational styles during discussions as to not let other players know they have turned robot. The primary objective for human players is to identify and vote out the Mafia whereas the Mafia's job is to survive and turn everyone into an AI player.

## User Roles
- Human Player: 
  - Join or create game lobbies
  - Participate in day and night cycles (discussions, strategizing, and voting).
  - Identify and vote out Mafia
- AI Player:
  - Mimic human conversation during the discussion phases.
  - Analyze game dynamics to make decisions and adapt strategies based on player interactions
- Developer/Admin Roles:
  - Monitor active games for performances and bugs.
  - Moderate lobbies and handle reports of inappropriate content(like metagaming/cheating)

## Roles and Permissions:
  - Player Permissions: Limited to game-related actions (e.g., joining lobbies, voting).
  - Admin Permissions: Ability to pause games, remove players, and moderate content.

