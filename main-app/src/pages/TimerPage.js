import { useTimer } from "react-timer-hook";
import { useNavigate, useParams } from "react-router-dom";
// import socket from "../service/socket";
import "../styles/ChatroomPage.css";

const Timer = ({ expiryTimestamp }) => {
  const {
    seconds,
    minutes,
    isRunning,
    start,
    pause,
    resume,
    restart,
  } = useTimer({ expiryTimestamp, onExpire: () => console.warn('onExpire called') });

  return (
    <div style={{ textAlign: 'center' }}>
      <h1>react-timer-hook</h1>
      <p>Timer Demo</p>
      <div style={{ fontSize: '100px' }}>
        <span>{minutes}</span>:<span>{seconds}</span>
      </div>
      <p>{isRunning ? 'Running' : 'Not running'}</p>
      <button onClick={start}>Start</button>
      <button onClick={pause}>Pause</button>
      <button onClick={resume}>Resume</button>
      <button onClick={() => {
        const time = new Date();
        time.setSeconds(time.getSeconds() + 300); // Restart to 5 minutes timer
        restart(time);
      }}>Restart</button>
    </div>
  );
};

export default function TimerPage() {
  const time = new Date();
  time.setSeconds(time.getSeconds() + 600); // 10 minutes timer

  return (
    <div>
      <h2>Timer Page</h2>
      <Timer expiryTimestamp={time} />
    </div>
  );
}
