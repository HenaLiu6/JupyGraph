const menuItems = [
  { icon: '📁', title: 'Files' },
  { icon: '⚙️', title: 'Settings' },
  { icon: '❔', title: 'Help' }
];

const menuContainer = document.getElementById('shelfMenu');
menuContainer.className = 'shelf-menu';

const header = document.createElement('div');
header.className = 'shelf-menu-header';
header.innerHTML = `
  <div class="shelf-selected">
    <span class="shelf-icon selected-icon"></span>
    <span class="shelf-title selected-title"></span>
  </div>
  <button class="shelf-toggle" title="Collapse menu">⯇</button>
`;

const items = document.createElement('div');
items.className = 'shelf-menu-items';

const content = document.createElement('div');
content.className = 'shelf-menu-content';
content.textContent = 'Select a menu item to begin.';

let selectedIndex = 0;

menuItems.forEach((item, index) => {
  const itemEl = document.createElement('button');
  itemEl.type = 'button';
  itemEl.className = 'shelf-menu-item';
  itemEl.innerHTML = `
    <span class="shelf-icon">${item.icon}</span>
    <span class="shelf-title">${item.title}</span>
  `;
  itemEl.addEventListener('click', () => {
    selectedIndex = index;
    setSelectedItem(index);
  });
  items.appendChild(itemEl);
});

menuContainer.appendChild(header);
menuContainer.appendChild(items);
menuContainer.appendChild(content);

const selectedIcon = header.querySelector('.selected-icon');
const selectedTitle = header.querySelector('.selected-title');
const toggleButton = header.querySelector('.shelf-toggle');

function setSelectedItem(index) {
  const item = menuItems[index];
  selectedIcon.textContent = item.icon;
  selectedTitle.textContent = item.title;
  content.textContent = `${item.title} panel is empty for now.`;
  Array.from(items.children).forEach((child, childIndex) => {
    child.classList.toggle('active', childIndex === index);
  });
}

let collapsed = false;

function updateMenuState() {
  menuContainer.classList.toggle('collapsed', collapsed);
  document.body.classList.toggle('shelf-collapsed', collapsed);
  if (collapsed) {
    toggleButton.textContent = '⯈';
    toggleButton.title = 'Expand menu';
  } else {
    toggleButton.textContent = '⯇';
    toggleButton.title = 'Collapse menu';
  }
}

toggleButton.addEventListener('click', (event) => {
  event.stopPropagation();
  collapsed = !collapsed;
  updateMenuState();
});

setSelectedItem(selectedIndex);
updateMenuState();

