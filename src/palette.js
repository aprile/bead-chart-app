// TEMPORARY palette of a few colours, until the stash palette in milestone 4.

import { getColor } from './colors.js';

const TEMP_COLOR_IDS = [
  'miyuki-401', // Opaque Black
  'miyuki-402', // Opaque White
  'miyuki-4201', // Duracoat Galvanized Silver
  'miyuki-4202', // Duracoat Galvanized Gold
  'miyuki-408', // Opaque Red
  'miyuki-414', // Opaque Cobalt
  'miyuki-412', // Opaque Turquoise Green (11/0 only)
  'miyuki-404', // Opaque Yellow
];

export function setupPalette(container) {
  let selectedId = TEMP_COLOR_IDS[0]; // null means the eraser

  const buttons = TEMP_COLOR_IDS.map((id) => {
    const color = getColor(id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'swatch';
    button.style.setProperty('--swatch', color.hex);
    button.title = `${color.code} ${color.name}`;
    button.setAttribute('aria-label', button.title);
    button.dataset.colorId = id;
    return button;
  });

  const eraser = document.createElement('button');
  eraser.type = 'button';
  eraser.className = 'eraser';
  eraser.textContent = 'Eraser';
  eraser.dataset.colorId = ''; // empty = no colour

  container.append(...buttons, eraser);

  function showSelected() {
    for (const button of [...buttons, eraser]) {
      const id = button.dataset.colorId || null;
      button.setAttribute('aria-pressed', id === selectedId);
    }
  }

  container.addEventListener('click', (event) => {
    // closest() finds the button even if you click something inside it.
    const button = event.target.closest('button');
    if (!button) return;
    selectedId = button.dataset.colorId || null;
    showSelected();
  });

  showSelected();
  return { getSelectedColorId: () => selectedId };
}
