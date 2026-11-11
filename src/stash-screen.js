// The "My stash" screen: browse all colours, filter them, tick the ones I own.

import {
  ALL_COLORS, BEAD_SIZE_NAMES, FAMILIES, FINISHES,
  isInStash, setInStash, stashCount,
} from './colors.js';
import { escapeHtml } from './html.js';

function optionsHtml(values) {
  return values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
}

function rowHtml(color) {
  const checkboxes = color.sizes
    .map(
      (size) => `
        <label>
          <input type="checkbox" data-size="${size}" ${isInStash(color.id, size) ? 'checked' : ''} />
          ${size}
        </label>`,
    )
    .join('');
  return `
    <li data-id="${escapeHtml(color.id)}">
      <span class="swatch" style="background: ${escapeHtml(color.hex)}"></span>
      <span class="code">${escapeHtml(color.code)}</span>
      <span class="name">
        ${escapeHtml(color.name)}
        <small>${escapeHtml(color.finish.join(', '))}</small>
      </span>
      <span class="sizes">${checkboxes}</span>
    </li>`;
}

export function setupStashScreen(root) {
  const search = root.querySelector('#stash-search');
  const sizeFilter = root.querySelector('#stash-size');
  const familyFilter = root.querySelector('#stash-family');
  const finishFilter = root.querySelector('#stash-finish');
  const onlyStash = root.querySelector('#stash-only');
  const counts = root.querySelector('#stash-counts');
  const showing = root.querySelector('#stash-showing');
  const list = root.querySelector('#stash-list');

  familyFilter.insertAdjacentHTML('beforeend', optionsHtml(FAMILIES));
  finishFilter.insertAdjacentHTML('beforeend', optionsHtml(FINISHES));

  // Build all 622 rows ONCE. Filtering just hides and shows them,
  // which is much faster than rebuilding the list on every keystroke.
  list.innerHTML = ALL_COLORS.map(rowHtml).join('');
  const rows = ALL_COLORS.map((color, i) => ({ color, element: list.children[i] }));

  function updateCounts() {
    counts.textContent =
      'In my stash: ' + BEAD_SIZE_NAMES.map((size) => `${size}: ${stashCount(size)}`).join(' · ');
  }

  function matches(color, words, size, family, finish, only) {
    // Every word you type must match the start of the code, or be in the name.
    const name = color.name.toLowerCase();
    const code = color.code.toLowerCase();
    if (!words.every((word) => code.startsWith(word) || name.includes(word))) return false;
    if (size && !color.sizes.includes(size)) return false;
    if (family && color.family !== family) return false;
    if (finish && !color.finish.includes(finish)) return false;
    if (only) {
      const sizesToCheck = size ? [size] : color.sizes;
      if (!sizesToCheck.some((s) => isInStash(color.id, s))) return false;
    }
    return true;
  }

  function applyFilters() {
    const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    const size = sizeFilter.value;
    const family = familyFilter.value;
    const finish = finishFilter.value;
    const only = onlyStash.checked;

    let shown = 0;
    for (const { color, element } of rows) {
      const visible = matches(color, words, size, family, finish, only);
      element.hidden = !visible;
      if (visible) shown++;
    }
    showing.textContent = `Showing ${shown} of ${ALL_COLORS.length} colours`;
  }

  // Any filter change: 'input' covers typing, selects and the checkbox.
  root.querySelector('.stash-filters').addEventListener('input', applyFilters);

  // Ticking a colour. One listener on the whole list ("event delegation")
  // instead of 895 separate checkbox listeners.
  list.addEventListener('change', (event) => {
    const checkbox = event.target;
    if (!checkbox.dataset.size) return;
    const id = checkbox.closest('li').dataset.id;
    setInStash(id, checkbox.dataset.size, checkbox.checked);
    updateCounts();
    // We don't re-filter here: with "only my stash" on, a colour you untick
    // stays visible until you change a filter, so a mis-click is easy to fix.
  });

  updateCounts();
  applyFilters();
}
