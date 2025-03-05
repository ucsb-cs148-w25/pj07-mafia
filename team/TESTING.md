# Testing Documentation

This document outlines the testing strategy for our Mafia game project, covering unit testing, component testing, and future testing considerations.

---

# Unit Test

## 1. Testing Libraries and Tools

### Jest
- **Purpose:**  
  Jest is our primary testing framework for unit tests. It provides a straightforward API, built-in mocking, and fast test execution.

- **Key Features:**
  - Automatic test discovery (files ending with `.test.js` or `.spec.js`).
  - Built-in mocking and module isolation.
  - Clear and descriptive error messages to aid debugging.

- **Configuration:**
  - Installed as a dev dependency in our `server` folder.
  - Configured in the `package.json` file with a test script:
    ```json
    "scripts": {
      "test": "jest"
    }
    ```
  - Tests are organized under the `tests/backend` folder.

## 2. Testing Approaches

- **Module Isolation:**  
  We use `jest.resetModules()` in our test files to ensure that module-level state is reset between tests. This is especially important for services that maintain in-memory state (such as our voting sessions).

- **Mocking Dependencies:**  
  Jest's built-in mocking capabilities are used to isolate tests from dependencies. For example, in our `votingService.test.js`, we mock `lobbyService` to control its behavior and focus on testing the `votingService`.

- **File Organization:**  
  Test files are placed under the `tests/backend` or `tests/frontend` folder to clearly separate them from production code.

## 3. Testing Scenarios

### Voting Service Tests

The `votingService.test.js` file covers a variety of scenarios for our voting functionality. The key areas tested include:

#### `startVoting`
- **Lobby Existence:**  
  - Returns `null` when a non-existent lobby is referenced.
- **Mafia Voting:**  
  - Includes only alive mafia players.
  - Excludes players that have been eliminated in previous rounds.
- **Villager Voting:**  
  - Includes all alive players regardless of role.

#### `castVote`
- **Valid Voting:**  
  - Records valid votes.
- **Duplicate Votes:**  
  - Prevents duplicate votes from being recorded.
- **Ineligible Voters/Targets:**  
  - Ignores votes from or toward players not present in the voting session.
- **Non-existent Sessions:**  
  - Logs a warning if an attempt is made to cast a vote in a non-existent session.

#### `calculateResults` and `endVoting`
- **Tie Vote Handling:**  
  - Returns `null` for tie votes and leaves player statuses unchanged.
- **Majority Vote:**  
  - Eliminates the player with the majority vote and updates their alive status accordingly.
- **Non-existent Sessions:**  
  - Returns `null` when ending a non-existent session.

#### `getVotingSessions` and `getSession`
- **Active Sessions Retrieval:**  
  - Retrieves all active voting sessions for a given lobby.
- **Non-existent Sessions:**  
  - Returns `null` when a session is not found.

## 4. Future Plan

### Voting Service (Core)
- **Extensive Coverage:**  
  The voting service is the core of our project and has been extensively tested. Our unit tests rigorously cover all critical aspects of the voting logic, including:
  - Initiating voting sessions
  - Recording votes with proper validations (preventing duplicates and handling ineligible voters/targets)
  - Resolving voting outcomes (handling tie scenarios and majority eliminations)

- **Ongoing Maintenance:**  
  We will continue to maintain and update these tests as needed to ensure that any changes or enhancements to the voting service do not compromise its stability.

### Chatroom and Lobby Components
- **User Experience Focus:**  
  For the chatroom and lobby components, testing will be conducted directly via the user interface on localhost. This approach allows us to validate these features in real-world scenarios and ensures that the overall user experience meets our quality standards.

- **Additional Testing if Needed:**  
  While our primary focus is on user experience, we will implement further tests if necessary based on user feedback and observed issues.

### Other Components
- **AI Integration:**  
  We may implement the unit testing to see if AI players can interact seamlessly with humans. The quality of our prompts will be through real-time interactions on the localhost interface.

- **Additional Components:**  
  Other components play a relatively minor role in our project. We will test them on the localhost interface as needed.

---

# Component Testing

## 1. Testing Tools

For our advanced testing, we leveraged **Storybook** to test our `ChatroomPage`. This testing is primarily **component testing**, with a hint of **integration testing**, as it simulates key socket interactions to ensure the component renders correctly in isolation.

## 2. Testing Approaches

- **Storybook Setup:**  
  We created a story for the ChatroomPage (`ChatroomPage.stories.js`), which sets up a MemoryRouter with an initial entry. This allows us to render the ChatroomPage in a controlled environment and visually verify its behavior.

- **Mocking Socket Behavior:**  
  To bypass issues such as the "lobby does not exist" error, we implemented a mock socket in `src/mocks/mockSocket.js`. This mock simulates essential socket events:
  - When the component emits the `"joinChatroom"` event, the mock immediately returns a successful join and triggers a simulated role assignment (assigning the role `"villager"`).
  
- **Configuration:**  
  We configured Storybook to use our mock socket by setting up a webpack alias in the Storybook configuration (`.storybook/main.js`). This ensures that all socket interactions within Storybook use our controlled, simulated version of the socket.

## 3. Limitations

- **Bare Minimum Simulation:**  
  The current implementation of our mock socket handles only the essential socket events needed to prevent errors and allow the ChatroomPage to render properly. While additional socket behaviors could be simulated (such as message broadcasting, vote submission responses, etc.), the current setup provides a bare minimum necessary for Storybook testing.

## 4. Future Plans

- **No Explicit Component/Integration/E2E Testing:**  
  Given our current focus on rapid development, improved functionality, and overall user experience, we have decided not to invest in formal component, integration, or end-to-end testing at this time. The Storybook setup provides us with the necessary confidence that the UI behaves correctly in isolation, and further testing will be done through direct interaction on the localhost interface.

- **Resource Allocation:**  
  Our team is prioritizing new features and user experience improvements over building extensive automated tests for every component. This strategic decision allows us to deploy enhancements more rapidly while still ensuring a quality product through continuous manual testing and feedback.