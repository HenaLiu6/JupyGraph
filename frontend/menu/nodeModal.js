// nodeModal.js

import { getActiveNode } from "../graph.js";
import { CodeField } from "../nodes/Components/CodeField.js"; 

let backdrop = null;
let container = null;
let modalNode = null;
let codeField = null;

function initModal() {
  if (backdrop) return;

  backdrop = document.createElement("div");
  container = document.createElement("div");


  Object.assign(backdrop.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
  });

  // Container to stack textarea perfectly over the code block
  Object.assign(container.style, {
    position: "relative",
    width: "80vw",
    height: "80vh",
    borderRadius: "16px",
    background: "#1e1e1e", // Standard dark theme background
    boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
    overflow: "hidden"
  });

  codeField = new CodeField({
    initialCode: "",
    language: "python",
    onChange: (code) => {
      if (!modalNode) return;

      modalNode.setCode(code);

      // optional: live update graph
      modalNode.graph?.setDirtyCanvas?.(true, true);
    },
    style: {
      container: {
        width: "100%",
        height: "100%",
        position: "absolute",
        left: "0",
        top: "0",
      }
    }
  });

  container.appendChild(codeField.getElement());
  backdrop.appendChild(container);
  document.body.appendChild(backdrop);

  backdrop.style.display = "none";


  backdrop.addEventListener("mousedown", (e) => {
    if (e.target === backdrop) closeModal();
  });
}

export function openCodeModal(node) {
  initModal();
  modalNode = node;
  codeField.setValue(node.properties.code ?? "");
  
  backdrop.style.display = "flex";
  
  setTimeout(() => {
    const textarea = codeField.textarea;
    textarea?.focus();
  }, 0);
}

export function closeModal() {
  if (!backdrop) return;
  backdrop.style.display = "none";

  if (modalNode) {
    modalNode.setCode(codeField.getValue());
    modalNode.graph?.setDirtyCanvas(true, true);
    modalNode = null;
  }
}

// Shift+Space toggles the modal for the selected node
window.addEventListener("keydown", (e) => {
  if (e.shiftKey && e.code === "Space") {
    e.preventDefault();

    const node = getActiveNode();
    if (!node) return;

    if (modalNode) {
      closeModal();
    } else {
      openCodeModal(node);
    }
  }
});

// Stop graph canvas from receiving keyboard events while modal is open
document.addEventListener("keydown", (e) => {
  if (backdrop?.style.display === "flex") {
    e.stopImmediatePropagation();
  }
}, true);