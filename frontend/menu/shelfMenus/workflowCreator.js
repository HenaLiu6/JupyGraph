import { createNewWorkflow } from "../../workflowManagement.js";

/**
 * Builds and returns the workflow creator DOM element.
 * @returns {HTMLElement} The creator widget.
 */
export function buildWorkflowCreator() {
  const container = document.createElement("div");
  container.className = "workflow-creator";

  const label = document.createElement("div");
  label.className = "workflow-creator-label";
  label.textContent = "New Workflow";
  container.appendChild(label);

  const row = document.createElement("div");
  row.className = "workflow-creator-row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "workflow-creator-input";
  input.placeholder = "Workflow name…";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "workflow-creator-button";
  button.textContent = "Create";

  row.appendChild(input);
  row.appendChild(button);
  container.appendChild(row);

  async function doCreate() {
    const name = input.value.trim();
    if (!name) return;

    button.disabled = true;
    try {
      await createNewWorkflow(name);
      input.value = "";
      // Dispatch a custom event so the tree can refresh
      container.dispatchEvent(new CustomEvent("workflowCreated", { bubbles: true }));
    } catch (err) {
      alert("Failed to create workflow: " + err.message);
    } finally {
      button.disabled = false;
    }
  }

  button.addEventListener("click", doCreate);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") doCreate();
  });

  return container;
}
