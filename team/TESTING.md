# Testing Documentation

This document outlines the testing libraries and approaches used in our Mafia codebase, along with details on the unit tests implemented.

---

## 1. Testing Libraries and Tools

### Jest
- **Purpose:**  
  Jest is our primary testing framework for unit and integration tests. It provides a straightforward API, built-in mocking, and fast test execution.

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

---

## 2. Testing Approaches

### Unit Testing
- **Module Isolation:**  
  We use `jest.resetModules()` in our test files to ensure that module-level state is reset between tests. This is important for services that maintain in-memory state (such as our voting sessions).

- **Mocking Dependencies:**  
  We use Jest’s built-in mocking capabilities to isolate tests from dependencies. For example, in our `votingService.test.js`, we mock `lobbyService` to control its behavior and focus on testing the `votingService`.

- **File Organization:**  
  Test files are placed under the `tests/backend` folder to separate them from production code. We use relative import paths (e.g., `../../server/services/votingService`) to correctly reference the source modules.

### No Additional Transpilers
- Our project uses standard Node.js JavaScript, so no additional transformation tools (like Babel) are required. Jest runs the tests directly using Node's native support for our code syntax.

---

## 3. Unit Tests Implemented

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

---

## 4. Conclusion

Our testing strategy, using Jest without any additional transpilers, is robust and well-integrated into our codebase. Comprehensive unit tests have been implemented to cover key functionalities of our Mafia game voting logic, ensuring reliability and maintainability. This document should serve as a guide for future testing enhancements and onboarding new team members.

