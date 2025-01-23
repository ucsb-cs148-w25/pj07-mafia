import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './components/Home'; // Import Home component
import Lobby from './components/Lobby'; // Import OtherScreen component

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/other" element={<Lobby />} />
      </Routes>
    </Router>
  );
};

export default App;