import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LobbyPage from "./pages/LobbyPage";
import ChatroomPage from "./pages/ChatroomPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        {/* 
          /lobby => no ID => LobbyPage will create a new lobby
          /lobby/:lobbyId => join an existing lobby 
        */}
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/lobby/:lobbyId" element={<LobbyPage />} />
        <Route path="/chatroom" element={<ChatroomPage />} />
      </Routes>
    </Router>
  );
}

export default App;
