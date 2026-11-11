// The pop-up forms on the stash screen:
// - add / edit a custom colour (and delete it)
// - edit the screen colour of a Miyuki colour
// - confirm a delete, choosing what replaces that colour's beads in the chart

import {
  addCustomColor, updateCustomColor, deleteCustomColor,
  setColorOverride, resetColorOverride, estimatedHex,
  stashColors, colorLabel,
} from './colors.js';
import { nearestColor } from './color-math.js';
import { getChart, countColor, replaceColorEverywhere } from './chart.js';
import { countColorInSavedCharts, replaceColorInSavedCharts } from './storage.js';
import { escapeHtml } from './html.js';

// onChange() runs after anything is saved, so the stash list can refresh.
export function setupColorDialogs(onChange) {
  // ---------- Add / edit custom colour ----------
  const customDialog = document.querySelector('#custom-color-dialog');
  const customForm = customDialog.querySelector('form');
  const customFields = customForm.elements;
  const customError = customForm.querySelector('.form-error');
  const deleteButton = customForm.querySelector('[data-action="delete"]');
  let editingColor = null; // null = adding a new colour

  function openCustomColor(color = null) {
    editingColor = color;
    customForm.reset();
    customError.hidden = true;
    customDialog.querySelector('.dialog-title').textContent = color ? 'Edit colour' : 'Add colour';
    deleteButton.hidden = !color;
    if (color) {
      customFields.name.value = color.name;
      customFields.hex.value = color.hex;
      customFields.code.value = color.code ?? '';
      customFields.notes.value = color.notes ?? '';
    }
    // Tick the colour's sizes (or 11/0 for a new colour, as a starting point).
    const sizes = color ? color.sizes : ['11/0'];
    for (const checkbox of customFields.sizes) checkbox.checked = sizes.includes(checkbox.value);
    customDialog.showModal(); // showModal = the rest of the page can't be clicked
  }

  customForm.addEventListener('submit', (event) => {
    event.preventDefault(); // we save it ourselves instead of reloading the page
    const sizes = [...customFields.sizes].filter((box) => box.checked).map((box) => box.value);
    const name = customFields.name.value.trim();
    if (!name) return showError('Give the colour a name.');
    if (sizes.length === 0) return showError('Choose at least one size.');

    const fields = {
      name,
      hex: customFields.hex.value,
      sizes,
      code: customFields.code.value,
      notes: customFields.notes.value,
    };
    if (editingColor) updateCustomColor(editingColor.id, fields);
    else addCustomColor(fields);
    customDialog.close();
    onChange();
  });

  function showError(message) {
    customError.textContent = message;
    customError.hidden = false;
  }

  deleteButton.addEventListener('click', () => {
    customDialog.close();
    confirmDelete(editingColor);
  });

  // ---------- Edit a Miyuki colour's screen colour ----------
  const screenDialog = document.querySelector('#screen-color-dialog');
  const screenForm = screenDialog.querySelector('form');
  let screenColor = null;

  function openScreenColor(color) {
    screenColor = color;
    const estimated = estimatedHex(color.id);
    screenForm.querySelector('.dialog-color-name').textContent = colorLabel(color);
    screenForm.elements.hex.value = color.hex;
    screenForm.querySelector('.estimated-swatch').style.background = estimated;
    screenForm.querySelector('.estimated-hex').textContent = estimated;
    screenForm.querySelector('[data-action="reset"]').disabled = !color.edited;
    screenDialog.showModal();
  }

  screenForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const hex = screenForm.elements.hex.value;
    // Picking exactly the estimate is the same as resetting.
    if (hex === estimatedHex(screenColor.id)) resetColorOverride(screenColor.id);
    else setColorOverride(screenColor.id, hex);
    screenDialog.close();
    onChange();
  });

  screenForm.querySelector('[data-action="reset"]').addEventListener('click', () => {
    resetColorOverride(screenColor.id);
    screenDialog.close();
    onChange();
  });

  // ---------- Delete a custom colour ----------
  const deleteDialog = document.querySelector('#delete-color-dialog');
  const deleteForm = deleteDialog.querySelector('form');
  const replacementSelect = deleteForm.elements.replacement;
  const replacementSwatch = deleteForm.querySelector('.replacement-swatch');
  let deletingColor = null;
  let replacementChoices = [];

  function confirmDelete(color) {
    deletingColor = color;
    const chart = getChart();
    // Possible replacements: my stash colours in the chart's bead size.
    replacementChoices = stashColors(chart.beadSize).filter((c) => c.id !== color.id);
    const suggested = nearestColor(color.hex, replacementChoices);
    const usedHere = countColor(color.id);
    const elsewhere = countColorInSavedCharts(color.id, chart.id); // my other saved charts

    if (usedHere === 0 && elsewhere.beads === 0) {
      if (!confirm(`Delete “${colorLabel(color)}”?`)) return;
      // Not in any chart now, but it might be in the undo history.
      finishDelete(suggested?.id ?? null);
      return;
    }

    const beads = (n) => `${n} bead${n === 1 ? '' : 's'}`;
    const places = [];
    if (usedHere > 0) places.push(`${beads(usedHere)} of the open chart`);
    if (elsewhere.beads > 0) {
      places.push(`${beads(elsewhere.beads)} in ${elsewhere.charts} other chart${elsewhere.charts === 1 ? '' : 's'}`);
    }
    deleteForm.querySelector('.delete-message').textContent =
      `“${colorLabel(color)}” is used in ${places.join(' and ')}.`;

    // Suggested colour first, then the rest of the stash, then "empty".
    const others = replacementChoices.filter((c) => c !== suggested);
    replacementSelect.innerHTML = [
      suggested && `<option value="${escapeHtml(suggested.id)}">${escapeHtml(colorLabel(suggested))} (looks closest)</option>`,
      ...others.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(colorLabel(c))}</option>`),
      `<option value="">Leave those beads empty</option>`,
    ]
      .filter(Boolean)
      .join('');
    showReplacementSwatch();
    deleteDialog.showModal();
  }

  // The little swatch next to the dropdown shows the chosen replacement.
  function showReplacementSwatch() {
    const choice = replacementChoices.find((c) => c.id === replacementSelect.value);
    replacementSwatch.style.background = choice ? choice.hex : 'transparent';
    replacementSwatch.classList.toggle('empty', !choice);
  }
  replacementSelect.addEventListener('change', showReplacementSwatch);

  deleteForm.addEventListener('submit', (event) => {
    event.preventDefault();
    finishDelete(replacementSelect.value || null);
    deleteDialog.close();
  });

  function finishDelete(replacementId) {
    replaceColorEverywhere(deletingColor.id, replacementId);
    replaceColorInSavedCharts(deletingColor.id, replacementId, getChart().id);
    deleteCustomColor(deletingColor.id);
    onChange();
  }

  // ---------- Cancel buttons (all three dialogs) ----------
  for (const dialog of [customDialog, screenDialog, deleteDialog]) {
    dialog.querySelector('[data-action="cancel"]').addEventListener('click', () => dialog.close());
  }

  return { openCustomColor, openScreenColor };
}
