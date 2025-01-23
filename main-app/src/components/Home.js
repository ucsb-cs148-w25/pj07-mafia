import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div>
      <h1>Home Screen</h1>
      <button>
        <Link to="/other">Go to Other Screen</Link>
      </button>
    </div>
  );
};

export default Home;