// Workflow management helper for file-backed persistence via server

let wsClientRef = null;
let graphRef = null;
let requestId = 0;
const pendingRequests = new Map();
let saveTimer = null;

function sendRequest(type, payload = {}) {
  requestId += 1;
  const request = {
    type,
    requestId,
    ...payload,
  };

  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject });
    wsClientRef.send(request);
    window.setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error(`Workflow request ${type} timed out`));
      }
    }, 5000);
  });
}

function handleServerMessage(data) {
  if (!data) return;

  if (typeof data.requestId !== "undefined") {
    const pending = pendingRequests.get(data.requestId);
    if (pending) {
      pendingRequests.delete(data.requestId);
      if (data.type === "workflow.error") {
        pending.reject(new Error(data.message || "Workflow error"));
      } else {
        pending.resolve(data);
      }
    }
  }
}

function clearGraph() {
  if (!graphRef) {
    return;
  }

  if (typeof graphRef.clear === "function") {
    graphRef.clear();
    return;
  }

  const nodes = graphRef._nodes ? graphRef._nodes.slice() : [];
  nodes.forEach((node) => {
    if (typeof graphRef.remove === "function") {
      graphRef.remove(node);
    }
  });
}

function connectNodes(source, output_slot, target, input_slot) {
  if (!source || !target) {
    return;
  }

  if (typeof graphRef.connect === "function") {
    graphRef.connect(source, output_slot, target, input_slot);
  } else if (typeof source.connect === "function") {
    source.connect(output_slot, target, input_slot);
  }
}

function serializeGraph() {
  if (!graphRef) {
    return null;
  }

  if (typeof graphRef.serialize === "function") {
    return graphRef.serialize();
  }

  const nodes = (graphRef._nodes || []).map((node) => ({
    id: node.id,
    type: node.type,
    properties: node.properties || {},
    pos: node.pos || [0, 0],
    size: node.size || undefined,
  }));

  const links = Object.values(graphRef.links || {}).map((link) => ({
    origin_id: link.origin_id,
    origin_slot: link.origin_slot,
    target_id: link.target_id,
    target_slot: link.target_slot,
  }));

  return { nodes, links };
}

function loadGraphState(state) {
  if (!graphRef || !state) {
    return;
  }

  clearGraph();

  if (typeof graphRef.configure === "function") {
    graphRef.configure(state);

    // Call onAdded for all nodes after configure
    (graphRef._nodes || []).forEach((node) => {
      if (node.outputPanel && node.stdout) {
        node.outputPanel.setVisible(node.stdout.length > 0);  //TODO, this should not be here?
        node.outputPanel.setOutputs(node.stdout);             //TODO, this should not be here?
      }
      if (typeof node.onAdded === "function") {
        node.onAdded();
      }
    });
    return;
  }

  const nodesById = {};
  (state.nodes || []).forEach((nodeData) => {
    const node = LiteGraph.createNode(nodeData.type || "basic/code");
    node.id = nodeData.id;
    node.properties = { ...node.properties, ...nodeData.properties };
    node.pos = nodeData.pos || [200, 200];
    if (Array.isArray(nodeData.size)) {
      node.size = nodeData.size.slice();
    }
    
    // Restore the stdout array on the node object directly
    node.stdout = nodeData.stdout || [];
    graphRef.add(node);
    
    // Feed the restored array into your upgraded OutputPanel component
    if (node.outputPanel) {
      node.outputPanel.setVisible(node.stdout.length > 0);  //TODO, this should not be here?
      node.outputPanel.setOutputs(node.stdout);             //TODO, this should not be here?
    }

    if (typeof node.onAdded === "function") {
      node.onAdded();
    }
    nodesById[node.id] = node;
  });

  (state.links || []).forEach((link) => {
    connectNodes(
      nodesById[link.origin_id],
      link.origin_slot,
      nodesById[link.target_id],
      link.target_slot
    );
  });
}

export function initWorkflowManager(wsClient, graph) {
  wsClientRef = wsClient;
  graphRef = graph;
  wsClient.addMessageListener(handleServerMessage);

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      saveCurrentWorkflow().catch(() => {});
    });
  }

  return {
    loadLastWorkflow,
    saveCurrentWorkflow,
    scheduleSave,
    saveWorkflow,
    loadWorkflow,
    listWorkflows,
  };
}

export async function loadLastWorkflow() {
  const response = await sendRequest("workflow.get_last");
  if (response && response.workflow && response.workflow.state) {
    loadGraphState(response.workflow.state);
  }
  return response;
}

export async function listWorkflows() {
  const response = await sendRequest("workflow.list");
  return response.workflows || [];
}

export async function loadWorkflow(id) {
  const response = await sendRequest("workflow.load", { id });
  if (response && response.workflow && response.workflow.state) {
    loadGraphState(response.workflow.state);
  }
  return response;
}

export async function saveWorkflow(id = "autosave", title = "Autosave") {
  const state = serializeGraph();
  if (!state) {
    throw new Error("Graph is not initialized");
  }
  return await sendRequest("workflow.save", {
    workflow: { id, title, state },
  });
}

export async function saveCurrentWorkflow() {
  return saveWorkflow("autosave", "Autosave");
}

export function scheduleSave(delay = 300) {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = window.setTimeout(() => {
    saveCurrentWorkflow().catch(() => {});
  }, delay);
}