const listeners = {};

const mockSocket = {
  on: (event, callback) => {
    if (!listeners[event]) {
      listeners[event] = [];
    }
    listeners[event].push(callback);
  },
  off: (event, callback) => {
    if (listeners[event]) {
      listeners[event] = listeners[event].filter(cb => cb !== callback);
    }
  },
  emit: (event, data, ack) => {
    console.log(`[MOCK SOCKET] Emitting event: ${event}`, data);
    
    if (event === "joinChatroom") {
      // Simulate a successful join: no error and a call to requestRole
      if (ack) ack({ success: true });
      setTimeout(() => {
        // Simulate role assignment if requested
        listeners["roleAssigned"] && listeners["roleAssigned"].forEach(cb => cb({ role: "villager" }));
      }, 500);
    }
    
    // add other event simulations...
  },
  trigger: (event, data) => {
    if (listeners[event]) {
      listeners[event].forEach(cb => cb(data));
    }
  },
};

export default mockSocket;