// ─── Public metadata for the shelf menu ───
export const SHELF_ITEM = {
  icon: "❔",
  title: "Help"
};

/**
 * Builds and returns the Help panel element.
 * @returns {HTMLElement}
 */
export function buildPanel() {
  const panel = document.createElement("div");
  panel.className = "shelf-placeholder";
  panel.textContent = "Help panel is empty for now.";
  return panel;
}
