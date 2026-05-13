class WSClient {
  constructor(url) {
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("WS connected");
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.onMessage(data);
    };

    this.onMessage = () => {};
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
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }
}

// global instance
const wsClient = new WSClient("ws://localhost:6700");