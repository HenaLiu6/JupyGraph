class WSClient {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.messageListeners = [];
    this.sendQueue = [];
    this.requestId = 0;
    this.pendingRequests = new Map();

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
      if (data && data.requestId !== undefined) {
        const pending = this.pendingRequests.get(data.requestId);
        if (pending) {
          this.pendingRequests.delete(data.requestId);
          if (data.type === "workflow.error" || data.type === "python.error" ||
              data.type === "execution.error" || data.type === "protocol.error") {
            pending.reject(new Error(data.message || "Server error"));
          } else {
            pending.resolve(data);
          }
        }
      }
    };

    this.ws.onclose = () => {
      const error = new Error("WebSocket connection closed");
      for (const pending of this.pendingRequests.values()) {
        pending.reject(error);
      }
      this.pendingRequests.clear();
    };

    this.ws.onerror = () => {
      // onclose performs the rejection so callers receive one consistent error.
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

  sendStopExecution() {
    this.send({ type: "execution.stop" });
  }

  send(payload) {
    const message = JSON.stringify(payload);
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else {
      this.sendQueue.push(message);
    }
  }

  request(type, payload = {}, timeout = 10000) {
      this.requestId += 1;
      const requestId = this.requestId;
      return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          if (this.pendingRequests.delete(requestId)) {
            reject(new Error(`Request "${type}" timed out`));
          }
        }, timeout);
        this.pendingRequests.set(requestId, {
          resolve: (value) => { window.clearTimeout(timer); resolve(value); },
          reject: (error) => { window.clearTimeout(timer); reject(error); }
        });
        this.send({ type, requestId, ...payload });
      });
    }

  discoverPython(workspace) {
    return this.request("python.environments", workspace ? { workspace } : {});
  }

  selectPython(interpreter, workspace) {
    const payload = { interpreter };
    if (workspace) payload.workspace = workspace;
    return this.request("python.select_interpreter", payload);
  }
}

// global instance
const wsClient = new WSClient("ws://localhost:6700");