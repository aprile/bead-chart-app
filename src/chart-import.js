// "Import chart…" in the charts menu: choose a chart file (.json), add it as
// a new chart and open it. If the chart uses Miyuki colours that aren't in my
// stash, a small dialog lists them and offers to add them.

import { checkChartFile, importChartFile } from './chart-file.js';
import { colorLabel, setInStash } from './colors.js';
import { escapeHtml } from './html.js';

// fileInput: the hidden <input type="file">. dialog: the "Add these colours?" dialog.
// onImported(savedChart): open the new chart.
// onStashChange(): the stash changed (the palette needs updating).
// Returns { choose } to open the file picker.
export function setupChartImport({ fileInput, dialog, onImported, onStashChange }) {
  const form = dialog.querySelector('form');
  const message = dialog.querySelector('.import-colors-message');
  const list = dialog.querySelector('.import-colors-list');
  let toAdd = { colors: [], size: null };

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = ''; // so choosing the same file again still works
    if (!file) return;

    let data;
    try {
      data = JSON.parse(await file.text()); // await = wait for the file to be read
    } catch {
      alert("This file can't be read. Is it a Bead Chart chart file (.json)?");
      return;
    }
    const check = checkChartFile(data);
    if (!check.ok) {
      alert(check.error);
      return;
    }
    const result = importChartFile(data);
    if (!result) {
      alert("Couldn't save the chart: the browser's storage is full. Export a backup, then delete some charts.");
      return;
    }
    onImported(result.chart);
    if (result.addedColors > 0) onStashChange(); // new custom colours go straight into the stash
    if (result.notInStash.length > 0) offerColors(result);
  });

  function offerColors({ chart, notInStash, addedColors }) {
    toAdd = { colors: notInStash, size: chart.beadSize };
    const count = notInStash.length;
    const added = addedColors > 0
      ? ` (${addedColors} custom colour${addedColors === 1 ? ' was' : 's were'} added to your stash already.)`
      : '';
    message.textContent =
      `“${chart.name}” uses ${count} ${chart.beadSize} colour${count === 1 ? '' : 's'} that ${count === 1 ? "isn't" : "aren't"} in your stash.${added}`;
    list.innerHTML = notInStash
      .map((color) => `
        <li>
          <span class="swatch-inline" style="background: ${escapeHtml(color.hex)}"></span>
          ${escapeHtml(colorLabel(color))}
        </li>`)
      .join('');
    dialog.showModal();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    for (const color of toAdd.colors) setInStash(color.id, toAdd.size, true);
    dialog.close();
    onStashChange();
  });
  dialog.querySelector('[data-action="cancel"]').addEventListener('click', () => dialog.close());

  return {
    choose: () => fileInput.click(),
  };
}
