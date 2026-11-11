// The "My stash" screen: browse all colours, filter them, tick the ones I own,
// add custom colours and edit screen colours.

import {
  allColors, getColor, BEAD_SIZE_NAMES, FAMILIES, FINISHES,
  isInStash, setInStash, stashCount,
} from './colors.js';
import { setupColorDialogs } from './color-dialogs.js';
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

  // Small grey line under the name: finish for Miyuki colours, notes for custom ones.
  const details = color.custom ? color.notes ?? '' : color.finish.join(', ');
  const badges = [
    color.custom && '<span class="badge">custom</span>',
    color.edited && '<span class="badge">edited</span>',
  ]
    .filter(Boolean)
    .join(' ');
  // Custom colours: edit everything. Miyuki colours: edit the screen colour only.
  const action = color.custom ? 'edit-custom' : 'edit-screen';
  const actionLabel = color.custom ? 'Edit' : 'Edit colour';

  return `
    <li data-id="${escapeHtml(color.id)}">
      <span class="swatch" style="background: ${escapeHtml(color.hex)}"></span>
      <span class="code">${escapeHtml(color.code ?? '')}</span>
      <span class="name">
        ${escapeHtml(color.name)} ${badges}
        <small>${escapeHtml(details)}</small>
      </span>
      <span class="sizes">${checkboxes}</span>
      <button type="button" class="row-action" data-action="${action}">${actionLabel}</button>
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

  familyFilter.insertAdjacentHTML('beforeend', optionsHtml(FAMILIES) + '<option value="custom">custom (my colours)</option>');
  finishFilter.insertAdjacentHTML('beforeend', optionsHtml(FINISHES));

  // Build all rows at once. Filtering just hides and shows them, which is much
  // faster than rebuilding on every keystroke. We only rebuild after a colour
  // is added, edited or deleted.
  let rows = [];
  function renderList() {
    const colors = allColors();
    list.innerHTML = colors.map(rowHtml).join('');
    rows = colors.map((color, i) => ({ color, element: list.children[i] }));
  }

  function updateCounts() {
    counts.textContent =
      'In my stash: ' + BEAD_SIZE_NAMES.map((size) => `${size}: ${stashCount(size)}`).join(' · ');
  }

  function matchesWord(color, word) {
    return (
      color.code?.toLowerCase().startsWith(word) ||
      color.name.toLowerCase().includes(word) ||
      (color.custom && ('custom'.startsWith(word) || color.notes?.toLowerCase().includes(word)))
    );
  }

  function matches(color, words, size, family, finish, only) {
    // Every word you type must match the start of the code, or be in the name.
    if (!words.every((word) => matchesWord(color, word))) return false;
    if (size && !color.sizes.includes(size)) return false;
    if (family === 'custom' && !color.custom) return false;
    if (family && family !== 'custom' && color.family !== family) return false;
    if (finish && !color.finish?.includes(finish)) return false;
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
    showing.textContent = `Showing ${shown} of ${rows.length} colours`;
  }

  function refresh() {
    renderList();
    updateCounts();
    applyFilters();
  }

  const dialogs = setupColorDialogs(refresh);

  // Any filter change: 'input' covers typing, selects and the checkbox.
  root.querySelector('.stash-filters').addEventListener('input', applyFilters);

  root.querySelector('#add-color-button').addEventListener('click', () => dialogs.openCustomColor());

  // One listener on the whole list ("event delegation") instead of one per row.
  list.addEventListener('change', (event) => {
    const checkbox = event.target;
    if (!checkbox.dataset.size) return;
    const id = checkbox.closest('li').dataset.id;
    setInStash(id, checkbox.dataset.size, checkbox.checked);
    updateCounts();
    // We don't re-filter here: with "only my stash" on, a colour you untick
    // stays visible until you change a filter, so a mis-click is easy to fix.
  });

  list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const color = getColor(button.closest('li').dataset.id);
    if (button.dataset.action === 'edit-custom') dialogs.openCustomColor(color);
    else dialogs.openScreenColor(color);
  });

  refresh();
}
