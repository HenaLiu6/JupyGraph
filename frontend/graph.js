import { initDOMLayer } from "./domLayer.js";
import { initWorkflowManager } from "./workflowManagement.js";

LiteGraph.clearRegisteredTypes();

// Import and register CodeNode after clearing types
const { CodeNode } = await import("./nodes/CodeNode.js");
LiteGraph.registerNodeType("basic/code", CodeNode);

const canvasEl = document.getElementById("graph");

const graph = new LGraph();
const canvas = new LGraphCanvas(canvasEl, graph);

const workflowManager = initWorkflowManager(wsClient, graph);

graph.start();
initDOMLayer(canvas, graph);
window.workflowManager = workflowManager;

async function loadLastWorkflow() {
  try {
    await workflowManager.loadLastWorkflow();
  } catch (error) {
    console.warn("Failed to load last workflow:", error);
  }
}

loadLastWorkflow();
window.setInterval(() => {
  workflowManager.saveCurrentWorkflow().catch(() => {});
}, 5000);



// =========================
// Fix canvas resolution
// =========================
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;

  const width = window.innerWidth;
  const height = window.innerHeight;

  canvasEl.width = width * dpr;
  canvasEl.height = height * dpr;

  canvasEl.style.width = width + "px";
  canvasEl.style.height = height + "px";

  canvas.ds.scale = dpr;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// =========================
// Add Node
// =========================
function addNode() {
  const node = LiteGraph.createNode("basic/code");
  node.pos = [200, 200];
  graph.add(node);
  workflowManager.scheduleSave();
}

// =========================
// Build Graph JSON
// =========================
function buildGraphJSON() {
  const nodes = [];

  for (let node of graph._nodes) {
    const inputs = [];

    if (node.inputs) {
      for (let input of node.inputs) {
        if (input.link != null) {
          const link = graph.links[input.link];
          const parent = graph.getNodeById(link.origin_id);
          inputs.push(parent.id);
        }
      }
    }

    nodes.push({
      id: node.id,
      code: node.properties.code,
      inputs: inputs
    });
  }

  return {
    nodes: nodes,
    execute: nodes.length ? nodes[nodes.length - 1].id : null
  };
}

// =========================
// Run Graph
// =========================
function runGraph() {
  const json = buildGraphJSON();
  console.log("Sending:", json);
  wsClient.sendExecute(json);
}



// =========================
// Receive results
// =========================
wsClient.onMessage = (data) => {
  if (data.type === "done" || data.type === "node.update") {
    for (let node of graph._nodes) {
      const state = data.nodeStates[node.id];
      if (state) {
        if (state.vtab) {
          node.properties.vtab = state.vtab;
        }
        if (typeof state.stdout !== 'undefined') {
          node.properties.stdout = state.stdout;
        }
        if (node.updateDisplay) node.updateDisplay();
      }
    }

    graph.setDirtyCanvas(true);
  }
};


// =========================
// Bridge from node to wsClient
// =========================
function serializeNode(node) {
  return {
    id: node.id,
    code: node.properties.code,
    inputs: node.inputs ? node.inputs.map(i => i.link ? graph.links[i.link].origin_id : null).filter(Boolean) : []
  };
}

// Global logic for node actions
graph.onNodeAction = function(actionType, node) {
  const graphData = buildGraphJSON();
  graphData.execute = node.id; //Target node

  switch (actionType) {
    case "run_context":
      wsClient.sendExecute(graphData); 
      break;
      
    case "run_persistent":
      wsClient.sendExecutePersistent({
        id: node.id,
        code: node.properties.code,
        inputs: node.inputs ? node.inputs.map(i => i.link) : []
      });
      break;
      
    case "run_connected":
      wsClient.sendExecuteConnected(graphData);
      break;
  }
};


// =========================
// Fix double click litegraph search box not closing
// =========================
let searchBoxVisible = false;

function closeLiteGraphSearch() {
  const box = canvas.search_box;
  if (!box) return;

  box.style.display = "none";
  searchBoxVisible = false;
}

canvas.onMouseDown = function(e, localPos, _) {
  const box = canvas.search_box;
  if (!box) return;

  if (box.style.display !== "none") {
    if (searchBoxVisible) {
      closeLiteGraphSearch();
    }

    searchBoxVisible = true;
  } else {
    searchBoxVisible = false;
  }
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeLiteGraphSearch();
  }
});


// =========================
// UI bindings
// =========================
const runBtn = document.getElementById("runBtn");
if (runBtn) {
  runBtn.onclick = runGraph;
}

const addNodeBtn = document.getElementById("addNodeBtn");
if (addNodeBtn) {
  addNodeBtn.onclick = addNode;
}


// =========================
// Graph access points
// =========================

let activeNode = null;

export function getActiveNode() {
  return activeNode;
}

export function setActiveNode(node) {
  activeNode = node;
}

canvas.onNodeSelected = (node) => {
  setActiveNode(node);
};

canvas.onNodeDeselected = (node) => {
  if (getActiveNode() === node) {
    setActiveNode(null);
  }
};