// "Import chart…" in the charts menu: choose a chart file (.json), add it as
// a new chart and open it. If the chart uses Miyuki colours that aren't in my
// stash, the "Add these colours to your stash?" dialog offers them (stash-offer.js).

import { checkChartFile, importChartFile } from './chart-file.js';

// fileInput: the hidden <input type="file">. stashOffer: from stash-offer.js.
// onImported(savedChart): open the new chart.
// onStashChange(): the stash changed (the palette needs updating).
// Returns { choose } to open the file picker.
export function setupChartImport({ fileInput, stashOffer, onImported, onStashChange }) {
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

    const { chart, notInStash, addedColors } = result;
    const count = notInStash.length;
    const added = addedColors > 0
      ? ` (${addedColors} custom colour${addedColors === 1 ? ' was' : 's were'} added to your stash already.)`
      : '';
    stashOffer.offer({
      colors: notInStash,
      size: chart.beadSize,
      message: `“${chart.name}” uses ${count} ${chart.beadSize} colour${count === 1 ? '' : 's'} that ${count === 1 ? "isn't" : "aren't"} in your stash.${added}`,
    });
  });

  return {
    choose: () => fileInput.click(),
  };
}
