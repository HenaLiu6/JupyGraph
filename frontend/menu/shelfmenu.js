import * as workflowSelector from "./shelfMenus/workflowSelection.js";
import * as settingsPanel    from "./shelfMenus/settingsPanel.js";
import * as helpPanel        from "./shelfMenus/helpPanel.js";

// ─── Panel registry ───
// Each module exports { SHELF_ITEM, buildPanel }
const PANELS = [
  workflowSelector,
  settingsPanel,
  helpPanel
];

// ─── DOM shell ───

const menuContainer = document.getElementById("shelfMenu");
menuContainer.className = "shelf-menu";

const header = document.createElement("div");
header.className = "shelf-menu-header";
header.innerHTML = `
  <div class="shelf-selected">
    <span class="shelf-icon selected-icon"></span>
    <span class="shelf-title selected-title"></span>
  </div>
  <button class="shelf-toggle" title="Collapse menu">⯇</button>
`;

const itemsBar = document.createElement("div");
itemsBar.className = "shelf-menu-items";

const contentPanel = document.createElement("div");
contentPanel.className = "shelf-menu-content";

menuContainer.appendChild(header);
menuContainer.appendChild(itemsBar);
menuContainer.appendChild(contentPanel);

const selectedIcon  = header.querySelector(".selected-icon");
const selectedTitle = header.querySelector(".selected-title");
const toggleButton  = header.querySelector(".shelf-toggle");

// ─── State ───

let selectedIndex = 0;
let collapsed = false;

// ─── Build menu items from panel metadata ───

function buildMenu() {
  PANELS.forEach((panelModule, index) => {
    const meta = panelModule.SHELF_ITEM;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "shelf-menu-item";
    btn.innerHTML = `
      <span class="shelf-icon">${meta.icon}</span>
      <span class="shelf-title">${meta.title}</span>
    `;
    btn.addEventListener("click", () => selectPanel(index));
    itemsBar.appendChild(btn);
  });
}

// ─── Panel switching ───

function selectPanel(index) {
  selectedIndex = index;
  const meta = PANELS[index].SHELF_ITEM;

  selectedIcon.textContent  = meta.icon;
  selectedTitle.textContent = meta.title;

  Array.from(itemsBar.children).forEach((child, i) => {
    child.classList.toggle("active", i === index);
  });

  // Render the panel content
  contentPanel.innerHTML = "";
  const panel = PANELS[index].buildPanel();
  contentPanel.appendChild(panel);
}

// ─── Collapse / expand ───

function updateMenuState() {
  menuContainer.classList.toggle("collapsed", collapsed);
  document.body.classList.toggle("shelf-collapsed", collapsed);

  toggleButton.textContent = collapsed ? "⯈" : "⯇";
  toggleButton.title       = collapsed ? "Expand menu" : "Collapse menu";
}

toggleButton.addEventListener("click", (e) => {
  e.stopPropagation();
  collapsed = !collapsed;
  updateMenuState();
});

// ─── Init ───

buildMenu();
selectPanel(selectedIndex);
updateMenuState();
