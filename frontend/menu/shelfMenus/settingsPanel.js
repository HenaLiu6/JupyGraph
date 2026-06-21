// ─── Public metadata for the shelf menu ───
export const SHELF_ITEM = {
  icon: "⚙️",
  title: "Settings"
};

/**
 * Builds and returns the Settings panel element.
 * @returns {HTMLElement}
 */
export function buildPanel() {
  const panel = document.createElement("div");
  panel.className = "shelf-placeholder";
  panel.textContent = "Settings panel is empty for now.";
  return panel;
}
