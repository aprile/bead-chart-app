// The palette (right panel): the colours I can paint with, in the chart's bead size.
// - "My stash": just my stash colours (the usual view), in sections by
//   colour family (beige, black, blue… A–Z), which can be folded away.
// - "All colours": every colour made in that bead size (Miyuki and my custom
//   ones), with a ✓ on the ones in my stash, and a search box. They're in
//   sections by finish (opaque, silver lined…), which can be folded away.
// My custom colours have no family or finish: they're in "My colours", first.
// Clicking a colour chooses it for the brush. Hovering shows its name.
// Which view is showing, and which sections are folded, is remembered.

import { getColor, stashColors, allColors, sortByFamily, colorLabel, isInStash, setInStash } from './colors.js';
import { load, save, STORAGE_KEYS } from './storage.js';
import { escapeHtml } from './html.js';
import { setupTooltips } from './tooltip.js';

// The order of the finish sections. A colour goes under its first (main)
// finish: "silver lined, matte" is silver lined. Finishes not listed here go
// after these, in A–Z order.
const FINISH_ORDER = [
  'opaque', 'transparent', 'silver lined', 'lined', 'ceylon', 'galvanized', 'metallic',
  'plated', 'luminous', 'picasso', 'glazed', 'special coating', 'other',
];
const MY_COLOURS = 'my colours'; // the section for my custom colours (first)

// Family sections get keys like "family:blue", so folding "other" in one
// view doesn't fold it in the other.
const FAMILY_KEY = 'family:';

// "silver lined" → "Silver lined", "family:blue" → "Blue"
function sectionTitle(key) {
  const name = key.startsWith(FAMILY_KEY) ? key.slice(FAMILY_KEY.length) : key;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// The colours in sections: [{ key, colors }], my colours first.
// groupBy 'finish': by main finish, in FINISH_ORDER. 'family': by colour family, A–Z.
// Inside a section the colours keep the order they came in.
function bySection(colors, groupBy) {
  const sections = new Map();
  for (const color of colors) {
    let key;
    if (groupBy === 'family') key = FAMILY_KEY + (color.custom ? MY_COLOURS : color.family ?? 'other');
    else key = color.custom ? MY_COLOURS : color.finish?.[0] ?? 'other';
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key).push(color);
  }
  const rank = (key) => {
    if (key === MY_COLOURS || key === FAMILY_KEY + MY_COLOURS) return -1;
    if (groupBy === 'family') return 0; // then A–Z below
    const index = FINISH_ORDER.indexOf(key);
    return index === -1 ? FINISH_ORDER.length : index;
  };
  return [...sections]
    .map(([key, list]) => ({ key, colors: list }))
    .sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key));
}

// onSelect(colorId) runs when the chosen colour changes, by a click or because
// the palette changed (colorId is null when there are no colours).
// onPick() runs only when I click a colour (to switch to the brush).
// onStashChange() runs when "Add to my stash" is clicked.
export function setupPalette(container, { onSelect, onPick, onStashChange }) {
  container.innerHTML = `
    <div class="palette-mode" role="group" aria-label="Which colours to show">
      <button type="button" class="btn" data-size="sm" data-mode="stash">My stash</button>
      <button type="button" class="btn" data-size="sm" data-mode="all">All colours</button>
    </div>
    <input type="search" class="input palette-search" placeholder="Search code or name" aria-label="Search colours" hidden />
    <div class="swatches"></div>
    <p class="selected-name"></p>
    <button type="button" class="link-button palette-add" hidden>Add to my stash</button>
  `;
  const modeButtons = container.querySelectorAll('[data-mode]');
  const search = container.querySelector('.palette-search');
  const swatches = container.querySelector('.swatches');
  const selectedName = container.querySelector('.selected-name');
  const addButton = container.querySelector('.palette-add');
  setupTooltips(swatches);

  const saved = load(STORAGE_KEYS.palette);
  let mode = saved?.mode === 'all' ? 'all' : 'stash';
  // The finish sections I've folded away (by key, e.g. "opaque").
  const folded = new Set(Array.isArray(saved?.folded) ? saved.folded : []);
  let searching = false; // while searching, every section with matches is open

  function saveSettings() {
    save(STORAGE_KEYS.palette, { mode, folded: [...folded] });
  }
  let beadSize = null; // the bead size shown now
  let colors = []; // the colours shown now (before searching)
  // The chosen colour id, or null if there's none (empty palette).
  let selectedId = null;

  function showSelected() {
    for (const button of swatches.querySelectorAll('button[data-color-id]')) {
      button.setAttribute('aria-pressed', button.dataset.colorId === selectedId);
    }
    const color = selectedId && getColor(selectedId);
    selectedName.textContent = color ? colorLabel(color) : '';
    // A colour from "All colours" that isn't in my stash: offer to add it.
    addButton.hidden = !color || isInStash(color.id, beadSize);
    onSelect(selectedId);
  }

  // The colours for the current view and bead size.
  function colorsFor(size) {
    if (mode === 'stash') return stashColors(size);
    return sortByFamily(allColors().filter((color) => color.sizes.includes(size)));
  }

  // Every word typed must match the start of the code, or be in the name.
  function matchesSearch(color, words) {
    return words.every((word) => color.code?.toLowerCase().startsWith(word) || color.name.toLowerCase().includes(word));
  }

  function swatchHtml(color) {
    const inStash = mode === 'all' && isInStash(color.id, beadSize);
    const label = escapeHtml(colorLabel(color) + (inStash ? ' (in my stash)' : ''));
    return `<button type="button" class="swatch${inStash ? ' in-stash' : ''}" data-color-id="${escapeHtml(color.id)}"
      style="--swatch: ${escapeHtml(color.hex)}" data-tip="${label}" aria-label="${label}"></button>`;
  }

  // Foldable sections: per finish ("All colours") or per colour family ("My stash").
  function sectionsHtml(shown) {
    return bySection(shown, mode === 'all' ? 'finish' : 'family')
      .map(({ key, colors: list }) => {
        // In "My stash" every colour is in my stash, so there's no need to say so.
        const owned = mode === 'all' ? list.filter((color) => isInStash(color.id, beadSize)).length : 0;
        const open = searching || !folded.has(key);
        return `
          <details class="palette-section" data-section="${escapeHtml(key)}" ${open ? 'open' : ''}>
            <summary>
              ${escapeHtml(sectionTitle(key))}
              <span class="section-count">${list.length}${owned > 0 ? ` (${owned} in stash)` : ''}</span>
            </summary>
            <div class="swatch-grid">${list.map(swatchHtml).join('')}</div>
          </details>`;
      })
      .join('');
  }

  function drawSwatches() {
    const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    searching = mode === 'all' && words.length > 0;
    const shown = searching ? colors.filter((color) => matchesSearch(color, words)) : colors;

    if (colors.length === 0) {
      swatches.innerHTML = `
        <p class="palette-empty">
          No ${beadSize} colours in your stash yet.
          <button type="button" class="link-button" data-open="stash">Add some to your stash</button>,
          or choose All colours.
        </p>`;
    } else if (shown.length === 0) {
      swatches.innerHTML = `<p class="palette-empty">No colours match “${escapeHtml(search.value)}”.</p>`;
    } else {
      swatches.innerHTML = sectionsHtml(shown);
    }
  }

  // Folding a section away (or opening it) is remembered, except while searching.
  // ("toggle" doesn't bubble up, so we listen on the way down: capture.)
  swatches.addEventListener('toggle', (event) => {
    const section = event.target.closest?.('.palette-section');
    if (!section || searching) return;
    if (section.open) folded.delete(section.dataset.section);
    else folded.add(section.dataset.section);
    saveSettings();
  }, true);

  // (Re)build the swatches for a bead size. Called whenever the chart is redrawn,
  // so it picks up stash changes and bead-size changes.
  function show(size) {
    beadSize = size;
    for (const button of modeButtons) {
      const on = button.dataset.mode === mode;
      button.setAttribute('aria-pressed', on);
      button.dataset.variant = on ? 'secondary' : 'ghost';
    }
    search.hidden = mode !== 'all';
    colors = colorsFor(size);
    drawSwatches();

    // Keep the chosen colour if it's still here, otherwise pick the first one.
    if (!colors.some((color) => color.id === selectedId)) {
      selectedId = colors[0]?.id ?? null;
    }
    showSelected();
  }

  function setMode(newMode) {
    mode = newMode;
    saveSettings();
    search.value = '';
    show(beadSize);
  }

  for (const button of modeButtons) {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  }

  search.addEventListener('input', () => {
    drawSwatches();
    showSelected();
  });

  swatches.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-color-id]');
    if (!button) return;
    selectedId = button.dataset.colorId;
    showSelected();
    onPick();
  });

  addButton.addEventListener('click', () => {
    if (!selectedId) return;
    setInStash(selectedId, beadSize, true);
    onStashChange(); // redraws, which rebuilds the palette with the new ✓
  });

  // Choose a colour from code (the picker tool). If it isn't in "My stash",
  // the palette switches to "All colours". Returns false if the colour isn't
  // made in this bead size at all.
  function select(colorId) {
    if (!colors.some((color) => color.id === colorId)) {
      const color = getColor(colorId);
      if (!color || !color.sizes.includes(beadSize)) return false;
      setMode('all');
    }
    search.value = '';
    drawSwatches();
    selectedId = colorId;
    showSelected();
    // Open its section if it's folded away, so the chosen colour can be seen.
    const section = swatches.querySelector(`[data-color-id="${CSS.escape(colorId)}"]`)?.closest('.palette-section');
    if (section && !section.open) section.open = true;
    swatches.querySelector(`[data-color-id="${CSS.escape(colorId)}"]`)?.scrollIntoView({ block: 'nearest' });
    return true;
  }

  return { show, select, getSelectedColorId: () => selectedId };
}
