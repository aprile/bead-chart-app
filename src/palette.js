// The palette above the chart: my stash colours in the chart's bead size.

import { getColor, stashColors, colorLabel } from './colors.js';
import { escapeHtml } from './html.js';

export function setupPalette(container) {
  container.innerHTML = `
    <div class="swatches"></div>
    <button type="button" class="eraser" data-color-id="">Eraser</button>
    <span class="selected-name"></span>
  `;
  const swatches = container.querySelector('.swatches');
  const selectedName = container.querySelector('.selected-name');

  // The chosen colour id. null = the eraser. undefined = nothing chosen yet.
  let selectedId = undefined;

  function showSelected() {
    for (const button of container.querySelectorAll('button')) {
      const id = button.dataset.colorId || null;
      button.setAttribute('aria-pressed', id === selectedId);
    }
    const color = selectedId && getColor(selectedId);
    selectedName.textContent = color ? colorLabel(color) : 'Eraser';
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

    // Keep the chosen colour if it's still here. Otherwise pick the first one
    // (or the eraser if there are none). If you chose the eraser, it stays.
    const stillThere = colors.some((color) => color.id === selectedId);
    if (selectedId === undefined || (selectedId !== null && !stillThere)) {
      selectedId = colors[0]?.id ?? null;
    }
    showSelected();
  }

  container.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    selectedId = button.dataset.colorId || null;
    showSelected();
  });

  return { show, getSelectedColorId: () => selectedId };
}
