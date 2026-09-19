import { listDirectory, loadWorkflow } from "../../workflowManagement.js";
import { buildWorkflowCreator } from "./workflowCreator.js";

// ─── Public metadata for the shelf menu ───
export const SHELF_ITEM = {
  icon: "📁",
  title: "Files"
};


function getName(path) {
  return path.split("/").pop();
}

function createFileNode(name, fullPath) {
  const isWorkflow = name.toLowerCase().endsWith(".json");
  const btn = document.createElement(isWorkflow ? "button" : "div");
  if (isWorkflow) btn.type = "button";
  btn.className = `workflow-file-button${isWorkflow ? "" : " workflow-code-file"}`;
  btn.textContent = isWorkflow ? name : `${name} (Python source)`;

  if (!isWorkflow) return btn;

  btn.addEventListener("click", async () => {
    try {
      const workflowPath = fullPath.replace(/\\/g, "/");
      const marker = "/workflows/";
      const markerIndex = workflowPath.toLowerCase().lastIndexOf(marker);
      const workflowId = markerIndex >= 0
        ? workflowPath.slice(markerIndex + marker.length).replace(/\.json$/i, "")
        : name.replace(/\.json$/i, "");
      await loadWorkflow(workflowId);
    } catch (err) {
      alert("Failed to load workflow: " + err.message);
    }
  });

  return btn;
}


function createFolderNode(name, folderPath) {
  const details = document.createElement("details");
  details.className = "workflow-folder-node";
  details.dataset.folderPath = folderPath;
  details.dataset.loaded = "false";
  details.open = false;

  const summary = document.createElement("summary");
  summary.textContent = name;

  details.addEventListener("toggle", async () => {
    if (!details.open || details.dataset.loaded === "true") return;

    try {
      const children = await listDirectory(folderPath);
      const content = details.querySelector(".workflow-folder-contents") || document.createElement("div");
      content.className = "workflow-folder-contents";
      content.innerHTML = "";

      for (const child of children.items || []) {
        const childPath = folderPath ? `${folderPath}/${child.path}` : child.path;
        content.appendChild(renderNode(childPath, child));
      }

      if (!details.querySelector(".workflow-folder-contents")) {
        details.appendChild(content);
      }
      details.dataset.loaded = "true";
    } catch (err) {
      console.error("Failed to load folder contents", err);
    }
  });

  details.appendChild(summary);
  return details;
}


function renderNode(currentPath, node) {
  const name = getName(node.path);
  const frag = document.createDocumentFragment();

  if (!node.items || node.items.length === 0) {
    if (node.path && node.path.split("/").some(part => part === "")) {
      // no-op
    }
    if (node.items && node.items.length === 0 && currentPath) {
      const folder = createFolderNode(name, currentPath);
      const content = document.createElement("div");
      content.className = "workflow-folder-contents";
      folder.appendChild(content);
      frag.appendChild(folder);
      return frag;
    }
    frag.appendChild(createFileNode(name, currentPath));
    return frag;
  }

  const folder = createFolderNode(name, currentPath);
  const content = document.createElement("div");
  content.className = "workflow-folder-contents";

  for (const child of node.items) {
    const nextPath = currentPath + "/" + child.path;
    content.appendChild(renderNode(nextPath, child));
  }

  folder.appendChild(content);
  frag.appendChild(folder);

  return frag;
}

async function renderTree(container) {
  container.innerHTML = "Loading workflows…";

  try {
    if (!window.workflowManager) {
      await new Promise((resolve) => {
        window.addEventListener("workflow-manager-ready", resolve, { once: true });
      });
    }

    const tree = await listDirectory();

    if (!tree || typeof tree !== "object" || !tree.path) {
      throw new Error("The server returned no workspace folder. Start the server with a workspace path.");
    }

    container.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "workflow-tree-container";

    wrap.appendChild(
      renderNode(tree.path, tree)
    );

    container.appendChild(wrap);

  } catch (err) {
    container.innerHTML =
      `<p class="error">Unable to list workflows: ${err.message}</p>`;
  }
}

// ─── Public panel builder ───

/**
 * Builds and returns the complete Files panel element.
 * @returns {HTMLElement}
 */
export function buildPanel() {
  const panel = document.createElement("div");

  // Creator widget
  const creator = buildWorkflowCreator();
  panel.appendChild(creator);

  // Tree container
  const treeContainer = document.createElement("div");
  panel.appendChild(treeContainer);

  // Initial load
  renderTree(treeContainer);

  // Refresh when a new workflow is created
  creator.addEventListener("workflowCreated", () => {
    renderTree(treeContainer);
  });

  return panel;
}
