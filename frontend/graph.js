import { initDOMLayer } from "./domLayer.js";

LiteGraph.clearRegisteredTypes();
const canvasEl = document.getElementById("graph");

const graph = new LGraph();
const canvas = new LGraphCanvas(canvasEl, graph);



graph.start();
initDOMLayer(canvas, graph);



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
  if (data.type === "done") {
    for (let node of graph._nodes) {
      const state = data.nodeStates[node.id];
      if (state) {
        node.properties.output = JSON.stringify(state);
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
// UI bindings
// =========================
document.getElementById("runBtn").onclick = runGraph;
document.getElementById("addNodeBtn").onclick = addNode;