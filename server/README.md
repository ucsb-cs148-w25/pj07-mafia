# Mafia Game Backend Structure

Hopefully this README will serve as a good guide for you to follow through the folder structure and understand where to start working on different features of the project. Each section will outline the purpose of specific folders and files and direct you to the relevant areas depending on which feature or system you're working on.

## Feature Breakdown
# 1. Voting System
If you are working on the voting system you want to handle all voting-related logic. This is voting during the day phase and specialized role voting like Mafia during the night phase. This system should be designed to be reusable across different parts of the game.
Files to work with:
- controllers/votingController.js: Handles REST endpoints for voting actions, such as starting or retrieving a voting session.
- socket/votingSocket.js: Handles real-time voting events (e.g., players casting votes or receiving voting results).
- services/VotingService.js: Implements the core business logic for managing voting sessions and aggregating results.
- models/votingModel.js: Represents the structure of voting sessions and stores votes in the database.

# 2. Roles System
The roles system is responsible for assigning and managing player roles (e.g. Mafia, Doctor, Detective). It ensures balanced role distribution and tracks role-based actions.
Files to work with:
- services/RoleService.js: Implements logic for assigning and managing roles, including role validation.
- models/playerModel.js: Tracks player roles and other attributes.
Tasks:
- Randomly assign roles to players when the game starts
- Add logic for role-based actions like Mafia voting or Doctor healing

# 3. Game State
The game state system manages the game's overall flow, including the transitions between the day and night phases and tracking win/loss conditions.
Files to work with:
- controllers/gameController.js: Handles REST endpoints for game state changes.
- socket/gameSocket.js: Handles real-time updates for game state transitions.
- models/gameStateModel.js: Stores the current game state and tracks important phase-related data.
Tasks:
- Implement the day/night cycle and transition logic.
- Add logic to check win/loss conditions for Mafia or Town.

# 4. Lobby System
The lobby system manages the creation, joining, and management of lobbies where players can prepare for the game.
Files to work with:
- controllers/lobbyController.js: handles REST endpoints for lobby creation and updates.
- socket/lobbySocket.js: handles real-time lobby-related events (e.g. player joins or leaves).
- services/LobbyServices.js: implements the core logic for lobby creation, player management, and readiness checks.
- models/lobbyModel.js: Tracks lobby details, including players and their statuses.
Tasks:
- Allow players to create and join lobbies using a unique session ID.
- Track player readiness and manage lobby ownership.

# 5. Chatroom
The chatroom system enables real-time communication between players, with separate chat logs for the day and night phases.
Files to work with:
- controllers/chatControllers.js : handles REST endpoints for fetching chat logs.
- socket/chatSocket.js: Handles real-time chat events (e.g., sending and receiving messages)
- models/playerModel.js: tracks which player is sending messages
Tasks:
- Implement a chat system for real-time messaging.
- Add separate chatrooms for day and night phases.
