import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import GameOver from './components/GameOver';
import './styles/App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/gameover" element={<GameOver />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
