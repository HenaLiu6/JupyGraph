import { listWorkflows, loadWorkflow } from "../../workflowManagement.js";
import { buildWorkflowCreator } from "./workflowCreator.js";

// ─── Public metadata for the shelf menu ───
export const SHELF_ITEM = {
  icon: "📁",
  title: "Files"
};

// ─── Tree builder ───

function buildTree(workflows) {
  const root = { dirs: {}, files: [] };
  workflows.forEach((wf) => {
    const segs = wf.relativePath.split("/");
    let node = root;
    segs.forEach((seg, i) => {
      if (i === segs.length - 1) {
        node.files.push({ ...wf, fileName: seg });
      } else {
        node.dirs[seg] = node.dirs[seg] || { dirs: {}, files: [] };
        node = node.dirs[seg];
      }
    });
  });
  return root;
}

function createFolderNode(name, node) {
  const details = document.createElement("details");
  details.className = "workflow-folder-node";
  details.open = true;

  const summary = document.createElement("summary");
  summary.textContent = name;
  details.appendChild(summary);

  const contents = document.createElement("div");
  contents.className = "workflow-folder-contents";
  contents.appendChild(renderNode(node));
  details.appendChild(contents);

  return details;
}

function renderNode(node) {
  const frag = document.createDocumentFragment();

  const dirNames = Object.keys(node.dirs).sort((a, b) => a.localeCompare(b));
  dirNames.forEach((dn) => {
    frag.appendChild(createFolderNode(dn, node.dirs[dn]));
  });

  if (node.files.length > 0) {
    const list = document.createElement("div");
    list.className = "workflow-file-list";
    node.files
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
      .forEach((wf) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "workflow-file-button";
        btn.textContent = `${wf.title} — ${wf.relativePath}`;
        btn.addEventListener("click", async () => {
          try {
            await loadWorkflow(wf.id);
          } catch (err) {
            alert("Failed to load workflow: " + err.message);
          }
        });
        list.appendChild(btn);
      });
    frag.appendChild(list);
  }

  if (dirNames.length === 0 && node.files.length === 0) {
    const empty = document.createElement("div");
    empty.className = "workflow-empty-state";
    empty.textContent = "No workflows found.";
    frag.appendChild(empty);
  }

  return frag;
}

async function renderTree(container) {
  container.innerHTML = "Loading workflows…";
  try {
    const workflows = await listWorkflows();
    container.innerHTML = "";
    const root = buildTree(workflows);
    const wrap = document.createElement("div");
    wrap.className = "workflow-tree-container";
    wrap.appendChild(renderNode(root));
    container.appendChild(wrap);
  } catch (err) {
    container.innerHTML = `<p class="error">Unable to list workflows: ${err.message}</p>`;
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
