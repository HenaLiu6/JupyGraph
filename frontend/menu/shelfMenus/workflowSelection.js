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
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "workflow-file-button";
  btn.textContent = name;

  btn.addEventListener("click", async () => {
    try {
      await loadWorkflow(fullPath);
    } catch (err) {
      alert("Failed to load workflow: " + err.message);
    }
  });

  return btn;
}


function createFolderNode(name) {
  const details = document.createElement("details");
  details.className = "workflow-folder-node";
  details.open = true;

  const summary = document.createElement("summary");
  summary.textContent = name;

  details.appendChild(summary);
  return details;
}


function renderNode(currentPath, node) {
  const name = getName(node.path);
  const frag = document.createDocumentFragment();

  // FILE
  if (!node.items) {
    frag.appendChild(createFileNode(name, currentPath));
    return frag;
  }

  // FOLDER
  const folder = createFolderNode(name);
  const content = document.createElement("div");
  content.className = "workflow-folder-contents";

  if (node.items) {
    for (const child of node.items) {
      const nextPath = currentPath + "/" + child.path;
      content.appendChild(
        renderNode(nextPath, child)
      );
    }
  }

  folder.appendChild(content);
  frag.appendChild(folder);

  return frag;
}

async function renderTree(container) {
  container.innerHTML = "Loading workflows…";
  console.log("Ran");

  try {
    console.log("Ran1");
    const tree = await listDirectory();
    console.log("Ran2");
    console.log(tree);

    if (!tree || !tree.path) {
      throw new Error("Invalid response");
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
