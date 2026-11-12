// Show or hide the side panels with the buttons at each end of the top bar,
// so a long chart can use the whole width. Remembered between visits.
// Saved shape: { left: true, right: true }  (true = showing)

import { load, save, STORAGE_KEYS } from './storage.js';

// panels = { left: { panel, button }, right: { panel, button } }
export function setupPanels(panels) {
  const saved = load(STORAGE_KEYS.panels);
  const showing = { left: saved?.left !== false, right: saved?.right !== false };

  function update() {
    for (const [side, { panel, button }] of Object.entries(panels)) {
      panel.hidden = !showing[side];
      button.setAttribute('aria-pressed', showing[side]);
    }
  }

  for (const [side, { button }] of Object.entries(panels)) {
    button.addEventListener('click', () => {
      showing[side] = !showing[side];
      save(STORAGE_KEYS.panels, showing);
      update();
      // The canvas notices it got bigger or smaller by itself (chart-view.js).
    });
  }

  update();
}
