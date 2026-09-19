export const SHELF_ITEM = {
  icon: "⚙️",
  title: "Settings"
};

function makeLabel(text, control) {
  const label = document.createElement("label");
  label.className = "settings-label";
  label.textContent = text;
  label.appendChild(control);
  return label;
}

export function buildPanel() {
  const panel = document.createElement("div");
  panel.className = "settings-panel";

  const workspace = document.createElement("input");
  workspace.type = "text";
  workspace.className = "settings-input";
  workspace.placeholder = "Workspace path";

  const discover = document.createElement("button");
  discover.type = "button";
  discover.className = "settings-button";
  discover.textContent = "Discover environments";

  const interpreter = document.createElement("select");
  interpreter.className = "settings-input";
  interpreter.disabled = true;

  const status = document.createElement("div");
  status.className = "settings-status";
  status.textContent = "Loading Python environments…";

  panel.appendChild(makeLabel("Workspace", workspace));
  panel.appendChild(discover);
  panel.appendChild(makeLabel("Python interpreter", interpreter));
  panel.appendChild(status);

  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle("error", error);
  }

  function render(response) {
    interpreter.innerHTML = "";
    (response.environments || []).forEach((environment) => {
      const option = document.createElement("option");
      option.value = environment.interpreter;
      option.textContent = `${environment.name} — ${environment.interpreter}`;
      interpreter.appendChild(option);
    });
    interpreter.disabled = interpreter.options.length === 0;
    if (response.selectedInterpreter) {
      interpreter.value = response.selectedInterpreter;
    }
    if (response.workspace) workspace.value = response.workspace;
    setStatus(interpreter.options.length
      ? "Select an interpreter to restart execution."
      : "No virtual environments found.");
  }

  async function findEnvironments() {
    discover.disabled = true;
    setStatus("Discovering environments…");
    try {
      render(await wsClient.discoverPython(workspace.value.trim() || undefined));
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      discover.disabled = false;
    }
  }

  discover.addEventListener("click", findEnvironments);
  interpreter.addEventListener("change", async () => {
    if (!interpreter.value) return;
    interpreter.disabled = true;
    setStatus("Restarting Python worker…");
    try {
      const response = await wsClient.selectPython(
        interpreter.value,
        workspace.value.trim() || undefined
      );
      render(response);
      setStatus("Python worker restarted.");
    } catch (error) {
      setStatus(error.message, true);
      interpreter.disabled = false;
    }
  });

  // The panel is created lazily, so query the server after its controls exist.
  findEnvironments();
  return panel;
}
