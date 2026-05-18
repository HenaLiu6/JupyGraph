class WSClient {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.messageListeners = [];
    this.sendQueue = [];

    this.ws.onopen = () => {
      console.log("WS connected");
      for (const message of this.sendQueue) {
        this.ws.send(message);
      }
      this.sendQueue = [];
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.onMessage(data);
      this.messageListeners.forEach((listener) => listener(data));
    };

    this.onMessage = () => {};
  }

  addMessageListener(listener) {
    this.messageListeners.push(listener);
  }

  removeMessageListener(listener) {
    this.messageListeners = this.messageListeners.filter((item) => item !== listener);
  }

  sendExecute(graphJSON) {
    this.send({ type: "execute", graph: graphJSON });
  }

  sendExecutePersistent(nodeData) {
    this.send({ type: "execute_persistent", node: nodeData });
  }

  sendExecuteConnected(graphJSON) {
    this.send({ type: "execute_connected", graph: graphJSON });
  }

  send(payload) {
    const message = JSON.stringify(payload);
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else {
      this.sendQueue.push(message);
    }
  }
}

// global instance
const wsClient = new WSClient("ws://localhost:6700");