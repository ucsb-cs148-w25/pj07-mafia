import './App.css';

function App() {
  const containerStyle = {
    backgroundColor: "#8B0000", 
    backgroundSize: "cover",
    minHeight: "100vh",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
  };

  const titleStyle = {
    fontSize: "4rem",
    marginBottom: "1rem",
    textShadow: "2px 2px 5px black",
  };

  const buttonContainerStyle = {
    display: "flex",
    gap: "1rem",
  };

  const buttonStyle = {
    backgroundColor: "#000",
    color: "#fff",
    border: "2px solid #fff",
    padding: "1rem 2rem",
    fontSize: "1.2rem",
    cursor: "pointer",
  };

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Hello World</h1>
      <div style={buttonContainerStyle}>
        <button style={buttonStyle}>Start</button>
        <button style={buttonStyle}>Exit</button>
      </div>
    </div>
  );
}

export default App;
