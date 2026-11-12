// The palette (right panel): my stash colours in the chart's bead size.
// Clicking a colour chooses it for the brush.

import { getColor, stashColors, colorLabel } from './colors.js';
import { escapeHtml } from './html.js';

// onSelect(colorId) runs when the chosen colour changes, by a click or because
// the palette changed (colorId is null when there are no colours).
// onPick() runs only when I click a colour (to switch to the brush).
export function setupPalette(container, { onSelect, onPick }) {
  container.innerHTML = `
    <div class="swatches"></div>
    <p class="selected-name"></p>
  `;
  const swatches = container.querySelector('.swatches');
  const selectedName = container.querySelector('.selected-name');

  // The chosen colour id, or null if there's none (empty palette).
  let selectedId = null;

  function showSelected() {
    for (const button of swatches.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', button.dataset.colorId === selectedId);
    }
    const color = selectedId && getColor(selectedId);
    selectedName.textContent = color ? colorLabel(color) : '';
    onSelect(selectedId);
  }

  // (Re)build the swatches for a bead size. Called whenever the chart is redrawn,
  // so it picks up stash changes and bead-size changes.
  function show(beadSize) {
    const colors = stashColors(beadSize);

    if (colors.length === 0) {
      swatches.innerHTML = `
        <p class="palette-empty">
          No ${beadSize} colours in your stash yet.
          <a href="#stash">Add some on the stash screen</a>.
        </p>`;
    } else {
      swatches.innerHTML = colors
        .map((color) => {
          const label = escapeHtml(colorLabel(color));
          return `<button type="button" class="swatch" data-color-id="${escapeHtml(color.id)}"
            style="--swatch: ${escapeHtml(color.hex)}" title="${label}" aria-label="${label}"></button>`;
        })
        .join('');
    }

    // Keep the chosen colour if it's still here, otherwise pick the first one.
    if (!colors.some((color) => color.id === selectedId)) {
      selectedId = colors[0]?.id ?? null;
    }
    showSelected();
  }

  swatches.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-color-id]');
    if (!button) return;
    selectedId = button.dataset.colorId;
    showSelected();
    onPick();
  });

  // Choose a colour from code (the picker tool). Returns false if it isn't
  // in the palette (not in my stash in this bead size).
  function select(colorId) {
    if (!swatches.querySelector(`[data-color-id="${CSS.escape(colorId)}"]`)) return false;
    selectedId = colorId;
    showSelected();
    return true;
  }

  return { show, select, getSelectedColorId: () => selectedId };
}
