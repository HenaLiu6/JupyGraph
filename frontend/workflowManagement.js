let wsClientRef = null;
let graphRef = null;
let requestId = 0;
const pendingRequests = new Map();
let saveTimer = null;
let saveState = "saved";
let saveInFlight = null;
let saveRequestedWhileBusy = false;

// ─── Which real workflow is currently being edited (null = new/unsaved) ───
let currentWorkflowId = null;
let currentWorkflowTitle = null;

const AUTOSAVE_ID = "autosave";
const AUTOSAVE_TITLE = "Autosave";

function publishSaveState(state, message = "") {
  saveState = state;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("workflow-save-state", {
      detail: { state, message }
    }));
  }
}

// ─── Low-level WebSocket request helper ───

function sendRequest(type, payload = {}) {
  if (!wsClientRef || typeof wsClientRef.request !== "function") {
    return Promise.reject(new Error("Workflow manager is not connected to the server yet."));
  }
  return wsClientRef.request(type, payload, 5000);
}

function handleServerMessage(data) {
  if (!data || typeof data.requestId === "undefined") return;
  const pending = pendingRequests.get(data.requestId);
  if (!pending) return;

  pendingRequests.delete(data.requestId);
  if (data.type === "workflow.error") {
    pending.reject(new Error(data.message || "Workflow error"));
  } else {
    pending.resolve(data);
  }
}

// ─── Graph helpers ───

function clearGraph() {
  if (!graphRef) return;
  if (typeof graphRef.clear === "function") {
    graphRef.clear();
    return;
  }
  const nodes = graphRef._nodes ? graphRef._nodes.slice() : [];
  nodes.forEach((node) => {
    if (typeof graphRef.remove === "function") graphRef.remove(node);
  });
}

function connectNodes(source, outputSlot, target, inputSlot) {
  if (!source || !target) return;
  if (typeof graphRef.connect === "function") {
    graphRef.connect(source, outputSlot, target, inputSlot);
  } else if (typeof source.connect === "function") {
    source.connect(outputSlot, target, inputSlot);
  }
}

function serializeGraph() {
  if (!graphRef) return null;
  const state = typeof graphRef.serialize === "function"
    ? graphRef.serialize()
    : {
        // Fallback manual serialization
        nodes: (graphRef._nodes || []).map((node) => ({
          id: node.id,
          type: node.type,
          properties: node.properties || {},
          pos: node.pos || [0, 0],
          size: node.size || undefined,
          stdout: node.stdout || [],
        })),
        links: Object.values(graphRef.links || {}).map((link) => ({
          origin_id: link.origin_id,
          origin_slot: link.origin_slot,
          target_id: link.target_id,
          target_slot: link.target_slot,
        })),
      };

  // Vtables are runtime/cache state. Outputs remain persisted like notebook
  // cell output, while omitting vtables keeps saves from growing with imports
  // and accumulated execution state.
  return {
    ...state,
    nodes: (state.nodes || []).map((node) => {
      const { vtab, ...properties } = node.properties || {};
      return { ...node, properties };
    }),
  };
}

function loadGraphState(state) {
  if (!graphRef || !state) return;
  clearGraph();

  if (typeof graphRef.configure === "function") {
    graphRef.configure(state);
    (graphRef._nodes || []).forEach((node) => {
      if (node.outputPanel && node.stdout) {
        node.outputPanel.setVisible(node.stdout.length > 0);
        node.outputPanel.setOutputs(node.stdout);
      }
      if (typeof node.onAdded === "function") node.onAdded();
    });
    return;
  }

  // Fallback manual load
  const nodesById = {};
  (state.nodes || []).forEach((nodeData) => {
    const node = LiteGraph.createNode(nodeData.type || "basic/code");
    node.id = nodeData.id;
    node.properties = { ...node.properties, ...nodeData.properties };
    node.pos = nodeData.pos || [200, 200];
    if (Array.isArray(nodeData.size)) node.size = nodeData.size.slice();
    node.stdout = nodeData.stdout || [];
    graphRef.add(node);
    if (node.outputPanel) {
      node.outputPanel.setVisible(node.stdout.length > 0);
      node.outputPanel.setOutputs(node.stdout);
    }
    if (typeof node.onAdded === "function") node.onAdded();
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

// ─── Autosave helpers ───

/**
 * Save current graph state into the autosave workflow on the server.
 */
async function saveToAutosave() {
  const state = serializeGraph();
  if (!state) throw new Error("Graph is not initialized");
  const response = await sendRequest("workflow.save", {
    workflow: { id: AUTOSAVE_ID, title: AUTOSAVE_TITLE, state },
  });
  publishSaveState("draft-saved");
  return response;
}

/**
 * Load state from the autosave workflow on the server.
 */
async function loadFromAutosave() {
  const response = await sendRequest("workflow.load", { id: AUTOSAVE_ID });
  if (response && response.workflow && response.workflow.state) {
    loadGraphState(response.workflow.state);
    publishSaveState("saved");
  }
  return response;
}

// ─── Public API ───

export function initWorkflowManager(wsClient, graph) {
  wsClientRef = wsClient;
  graphRef = graph;
  wsClient.addMessageListener(handleServerMessage);

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      saveToAutosave().catch(() => {});
    });
  }

  return {
    loadLastWorkflow,
    saveCurrentWorkflow,
    scheduleSave,
    saveWorkflow,
    loadWorkflow,
    listDirectory,
    createNewWorkflow,
    getCurrentWorkflowId,
    getCurrentWorkflowTitle,
  };
}

/**
 * Returns the ID of the real workflow currently being edited (not autosave).
 * Returns null if the user is working on a new unsaved workflow.
 */
export function getCurrentWorkflowId() {
  return currentWorkflowId;
}

/**
 * Returns the title of the real workflow currently being edited.
 */
export function getCurrentWorkflowTitle() {
  return currentWorkflowTitle;
}

/**
 * Load the last-used workflow. Copies it into autosave for editing.
 */
export async function loadLastWorkflow() {
  const response = await sendRequest("workflow.get_last");
  if (response && response.workflow && response.workflow.state) {
    currentWorkflowId = response.workflow.id || null;
    currentWorkflowTitle = response.workflow.title || null;
    // Copy the loaded workflow into autosave so user edits the autosave copy
    await sendRequest("workflow.save", {
      workflow: {
        id: AUTOSAVE_ID,
        title: AUTOSAVE_TITLE,
        state: response.workflow.state,
      },
    });
    loadGraphState(response.workflow.state);
    publishSaveState("saved");
  }
  return response;
}

export async function listDirectory(folderPath = null) {
  const response = await sendRequest("directory.list", folderPath ? { folder: folderPath } : {});
  const tree = response?.paths || response;
  if (tree?.error) {
    throw new Error(tree.error);
  }
  return tree;
}

/**
 * Open an existing workflow by ID. Copies it into autosave for editing.
 */
export async function loadWorkflow(id) {
  const response = await sendRequest("workflow.load", { id });
  if (response && response.workflow && response.workflow.state) {
    currentWorkflowId = response.workflow.id;
    currentWorkflowTitle = response.workflow.title;
    // Copy into autosave
    await sendRequest("workflow.save", {
      workflow: {
        id: AUTOSAVE_ID,
        title: AUTOSAVE_TITLE,
        state: response.workflow.state,
      },
    });
    loadGraphState(response.workflow.state);
    publishSaveState("saved");
  }
  return response;
}

/**
 * Create a new workflow with the given name.
 * Clears the graph, sets currentWorkflowId to the new ID, and saves empty state to autosave.
 */
export async function createNewWorkflow(name) {
  const response = await sendRequest("workflow.createnew", { title: name });
  const newId = response.workflow?.id || response.workflow?.workflow_id || name;

  currentWorkflowId = newId;
  currentWorkflowTitle = name;

  clearGraph();
  await saveToAutosave();

  return response;
}

/**
 * Save the current autosave state OVER the real workflow.
 * If no real workflow is open, this is a no-op (use createNewWorkflow first).
 */
export async function saveWorkflow(id = currentWorkflowId, title = currentWorkflowTitle) {
  if (!id) {
    throw new Error("No workflow is currently open. Create or open a workflow first.");
  }
  const state = serializeGraph();
  if (!state) throw new Error("Graph is not initialized");

  // Save to the real workflow ID
  publishSaveState("saving");
  try {
    const response = await sendRequest("workflow.save", {
      workflow: { id, title: title || id, state },
    });
    publishSaveState("saved");
    return response;
  } catch (error) {
    publishSaveState("error", error.message);
    throw error;
  }
}

/**
 * Save current workflow (alias for saveWorkflow with current ID).
 */
export async function saveCurrentWorkflow() {
  return saveWorkflow(currentWorkflowId, currentWorkflowTitle);
}

/**
 * Debounced autosave to the autosave slot only (does NOT touch the real workflow).
 */
export function scheduleSave(delay = 1000) {
  if (saveTimer) clearTimeout(saveTimer);
  if (saveInFlight) {
    saveRequestedWhileBusy = true;
    publishSaveState("unsaved");
    return;
  }
  publishSaveState("unsaved");
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    publishSaveState("saving");
    const save = async () => {
      await saveToAutosave();
    };
    saveInFlight = save().catch((error) => {
      publishSaveState("draft-error", error.message);
    }).finally(() => {
      saveInFlight = null;
      if (saveRequestedWhileBusy) {
        saveRequestedWhileBusy = false;
        scheduleSave(0);
      }
    });
  }, delay);
}
