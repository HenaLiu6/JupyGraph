// domLayer.js

let domLayer = null;
let canvasRef = null;
let graphRef = null;

export function initDOMLayer(canvas, graph) {
  canvasRef = canvas;
  graphRef = graph;

  domLayer = document.createElement("div");

  Object.assign(domLayer.style, {
    position: "absolute",
    top: 0,
    left: 0,
    transformOrigin: "0 0",
    pointerEvents: "none"
  });

  document.body.appendChild(domLayer);

  updateDOMLayer();
  updateDOMNodes();
}

export function getDOMLayer() {
  return domLayer;
}

function updateDOMLayer() {
  if (!canvasRef) return;

  const rect = canvasRef.canvas.getBoundingClientRect();

  const scale = canvasRef.ds.scale;
  const offset = canvasRef.ds.offset;

  domLayer.style.transform =
    `translate(${rect.left + offset[0] * scale}px, ${rect.top + offset[1] * scale}px) scale(${scale})`;

  requestAnimationFrame(updateDOMLayer);
}

function updateDOMNodes() {
  if (!graphRef) return;

  for (let node of graphRef._nodes) {
    if (!node.dom) continue;

    const b = node.getBounding();

    node.dom.style.left = b[0] + "px";
    node.dom.style.top = b[1] + "px";
    node.dom.style.width = b[2] + "px";
    node.dom.style.height = b[3] + "px";
  }

  requestAnimationFrame(updateDOMNodes);
}