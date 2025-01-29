import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LobbyPage from "./pages/LobbyPage";
import ChatroomPage from "./pages/ChatroomPage";
import TimerPage from "./pages/TimerPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        {/* /lobby => no ID => LobbyPage will create a new lobby */}
        <Route path="/lobby" element={<LobbyPage />} />
        {/* /lobby/:lobbyId => join an existing lobby */}
        <Route path="/lobby/:lobbyId" element={<LobbyPage />} />
        {/* IMPORTANT: /chatroom/:lobbyId => dynamic path for the chatroom */}
        <Route path="/chatroom/:lobbyId" element={<ChatroomPage />} />
        <Route path="/timer" element={<TimerPage />} />
      </Routes>
    </Router>
  );
}

export default App;
