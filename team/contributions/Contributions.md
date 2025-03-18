## ALBERT 

## Code Contributions

**Multi-Player Chatroom**
- Developed the initial template for a functional multi-player chatroom

**Voting System** 
- Implemented the complete voting system, including both Mafia and Villager votes and regularly updated for new iterations

**AI Integration** 
- Enabled AI to speak on behalf of eliminated players.

**Backend Unit Testing**
- Developed unit tests for the voting system, covering both configuration and implementation.

**UI**
- Designed and implemented the initial UI for a functional multi-player chatroom, voting popup, eliminated players

**Frontend Testing with Storybook**
- Configured and implemented frontend component testing using Storybook.
- Developed a mocked socket behavior to ensure proper Chatroom rendering in Storybook.

**User Identification Improvements**
- Enhanced username identification by transitioning from local storage to session storage, fixing longstanding bugs and improving the development process.

**Configuration Management**
- Implemented a centralized configuration file for easier reference to values used across different components.

**Sidebar Implementation**
- Worked with Andy to integrate a sidebar into the chatroom.
- Developed the sidebar template for Andy to populate with game rules.

## Non-Code Contributions

**Documentation:**
- Authored AGREEMENTS.md.
- Authored the initial version of LEADERSHIP.md.
- Authored LEARNING.md.
- Authored NORMS.md.
- Authored user_journey.md.
- Authored problem_scenario.md.
- Authored TESTING.md.

## HUNG   

## Code Contributions
- minor fixes to constants.js so that it could compile
- modularized the code so that multiple people could work concurrently on the backend
- Implemented early prototype of roles, assigning players their roles in the backend and having it show up in the frontend
- Implemented early prototype of day/night cycle-- having a timer and then switching the frontend and backend from day/night gamestates
- working on adaptive phase change so that day turns to night when players finish voting
- working on allowing users to talk during voting cycles
- Created a player list to help players keep track of who is in the game.
- Fixed issues regarding players joining and leaving the lobby/chatroom affecting gameplay and lobby creation

## Non-Code related Contributions
- Provided documentation for how backend should owrk
- Provided documentation for README on how to run our code
- Created the User Manual

## PRIYANKA

## Code Contributions
**Day-Night Cycles**
- Designed and implemented the initial game time cycles.
- Assisted in migrating the time cycles to the backend.

**Winning Condition**
- Developed logic to count alive mafia and villagers for determining game outcomes.
- Modified voting sessions to emit the winning result alongside eliminated players.
- Collaborated with Andy on integrating winning conditions across the frontend and backend.
- Contributed to the mechanism supporting multiple mafia members.

## Non-Code Contributions 
- Contributed creative narrative ideas to enhance the game experience.
- Acted as the scribe during final scrum meetings.


## ANDY

## Code Contributions

- Created the main-app folder and server folder.
- Set up websockets (socket.io) in both the frontend and backend.

**WebSocket Remodularisation:**
- Remodularised different web sockets into a single backend folder.
  
**User and Lobby Management:**
- Implemented username creation.
- Developed lobby creation features on both the frontend and backend.
- Added functionality for joining a lobby on both the frontend and backend.
  
**Host Privileges:**
- Ensured that only the host player can start the game, with logic implemented in both frontend and backend.
  
**UI Enhancements:**
- Added an instruction button on the homepage.
- Implemented a feature to copy the Lobby ID.
- Integrated a chat bar sidebar for better in-game communication.

## Non-Code Contributions

## Documentation:
- Authored complete documentation for EVAL_RESPONSE.md.
- Authored complete documentation for DEPLOY.md.
- Prepared full documentation for USER_FEEDBACK_NEEDS.md.
- Prepared full documentation for MVP_FOLLOWUP.md.
  
**Deployment:**
- Managed the full Dokku deployment process for both the frontend and backend.

## SHIVANI 

## Code Contributions

- Overhauled the UI/UX design, including updating the theme, color palette, and fonts to enhance visual appeal and accessibility
- Implemented the in-game timer and day/night cycle, ensuring dynamic UI updates based on the current phase of the game
- Integrated the Claude API into both the backend and frontend by acquiring an API key and developing functions to send messages, receive responses, and display AI-generated text in chat
- Refined the voting system to ensure options appear only at the appropriate times for the relevant players (e.g., the mafia kill vote is restricted to mafia members at night, while the villager vote is accessible to all during the voting phase)
- Developed a seamless transition from the lobby to the chatroom at the start of the game

## Non-Code Contributions

- Brainstormed ways to make the user interface more intuitive and user-friendly
- Created the DESIGN.md document, detailing the system architecture diagram and the core functionality of various app components
- Led retrospectives to reflect on progress, identify challenges, and improve team workflows
- Contributed to USER_FEEDBACK.md by documenting UI changes and suggesting areas for future improvement

## TYLER 

## Code Contributions

**Constants File:**
- Makes testing easier by putting all constants into one file
- Allows developer to change minimum players, number of mafia, etc. to test certain features
  
**Adaptive Phase Feature:**
Lets the voting/night/day phase end as soon as everyone is done voting instead of when the timer ends
Allows for faster/smoother gameplay

## Non-Code Contributions

Retro Documentation:
documented all of the Retros throughout the quarter
Stand Up Documentation:
documented close to all of the stand ups throughout the course

## VICTOR 

## Code Contributions

**Voting Logic**
- Created voting logic and function logic for Doctors (save).
- Created voting logic and function logic for Detectives (investigate).
- Adjusted overall voting logic for night phase to better accomodate new logic.

**Minor UI/Codebase Changes**
- Created and adjusted some files in the beginning of the codebase for better organization and future proofing.
- Adjusted chatroom UI for consistency in the first version of our UI.

## Non-Code Contributions
**Documentation**
- Added LICENSE.md.
- Added .gitignore.
- Added full feedback for Retro 1.
