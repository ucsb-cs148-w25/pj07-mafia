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


## Installation
### Prerequisites
- Node.js ( >= v23.6.1)
- npm ( >= 10.9.2)
- git(if you want to clone locally)

### Dependencies
- Express: For running the Node.js server
- Socket.IO : For real-time, bidirectional communication between client and server(used in the voting/chat features)
- uuid: For generating unique IDs (e.g. lobby ids)
- React: For front-end UI (chatroom, lobbies, voting screen)
- React Router: For client-side routing between login, lobby, and game pages

### Installation Steps
1. Clone the repository  
```bash
git clone https://github.com/ucsb-cs148-w25/pj07-mafia.git
cd pj07-mafia
```
2. Install server dependencies  
```bash
cd server
npm install
```
3. Install client dependencies
```bash
cd ../main-app
npm install
```
4. Start the client
```bash
# from the main-app directory
npm start
```
5. Open up another terminal and start the server
```bash
cd ../server
node server.js
```
7. Access the App:
- The client typically runs on http://localhost:3000 which you can view after running the steps above.  
- If you ignore the steps above you can also check the game out on mafia.dokku-07.cs.ucsb.edu  

## Functionality
- On the homepage click Create Lobby which allows you to pick a username!
- Once you pick a username you will be moved to the lobby page where your lobby is given a unique UUID. Send this to your friends, or for testing purposes if you are on localhost open up new tabs.
- In these new tabs, click on join lobby and paste the lobby id into the pop up.
- Choose usernames for the tabs you have opened
- You need atleast 6 people to start the game!
- Once you have the people, the host who made the game can click start game.
- Once the game has started, all the players can chat and see each other talk.
- At the top you can see your role and what phase it is. After the day phases ends, the voting phase starts and they can vote to eliminate a player.
- Whoever has majority votes gets 'eliminated' which means they can no longer send messages to other players.
- After the voting phase it is night where no one can talk.

## Known problems
1. Not all players show up on the voting system, so if you click start vote you won't see everyones names.
2. People can talk during night phase
3. Dead/Eliminated people can vote
4. Mafia vote slider does not do anything
5. No win/lose condition

## Contributing
1. Fork it!
2. Create your feature branch: git checkout -b my-new-feature
3. Commit your changes: git commit -am "add some feature"
4. Push to the branch: git push origin my-new-feature
5. Submit a pull request.
6. Also feel free to comment on bugs!
