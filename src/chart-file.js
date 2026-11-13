// One chart as a file (.json), to keep a copy or move it to another
// browser or computer. (The full backup on the My charts page is separate.)
//
// File shape (from PLAN-V2.md):
// { type: "bead-chart", version: 2, exportedAt,
//   chart,                         ← the chart itself
//   customColors: [...],           ← the custom colours it uses (incl. its background bead)
//   colorOverrides: { id: hex } }  ← my screen-colour edits for the Miyuki colours it uses
// So it opens correctly in a browser that has never seen my colours.

import { CHART_VERSION, upgradeChart } from './migrate.js';
import { isValidChart, isValidCustomColors, isValidOverrides, listSavedCharts, saveChart } from './storage.js';
import {
  getColor, getColorOverride, setColorOverride, findCustomColor, addCustomColor, isInStash,
} from './colors.js';

export const CHART_FILE_TYPE = 'bead-chart';

// Every colour id the chart uses: its beads and its background bead.
function colorIdsUsed(chart) {
  const ids = new Set(chart.beads.flat().filter((id) => id !== null));
  if (chart.backgroundBead) ids.add(chart.backgroundBead);
  return ids;
}

// ---------- Export ----------

export function makeChartFile(chart) {
  const customColors = [];
  const colorOverrides = {};
  for (const id of colorIdsUsed(chart)) {
    const color = getColor(id);
    if (!color) continue; // a missing colour: nothing to include
    if (color.custom) customColors.push(color);
    else if (getColorOverride(id)) colorOverrides[id] = getColorOverride(id);
  }
  return {
    type: CHART_FILE_TYPE,
    version: CHART_VERSION,
    exportedAt: new Date().toISOString(),
    chart,
    customColors,
    colorOverrides,
  };
}

// A file name from the chart name, e.g. "Spiral cuff.json".
// Characters that aren't allowed in file names are left out.
function fileName(chart) {
  const name = chart.name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'chart';
  return `${name}.json`;
}

// Makes the browser download the chart file.
export function downloadChartFile(chart) {
  const file = new Blob([JSON.stringify(makeChartFile(chart), null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = fileName(chart);
  link.click();
  URL.revokeObjectURL(link.href);
}

// ---------- Import ----------

// Checks a chart file's contents. Returns { ok: true } or { ok: false, error }.
export function checkChartFile(data) {
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!isObject(data) || data.type !== CHART_FILE_TYPE) {
    return { ok: false, error: "This isn't a Bead Chart chart file. (A full backup is imported on the My charts page.)" };
  }
  if (!Number.isInteger(data.version) || data.version < 1) {
    return { ok: false, error: 'This chart file has no valid version number.' };
  }
  if (data.version > CHART_VERSION) {
    return { ok: false, error: 'This chart file was made by a newer version of the app.' };
  }
  // The chart gets a new id when it's imported, so a missing id is fine here.
  const chart = upgradeChart(isObject(data.chart) ? { id: 'imported', ...data.chart } : data.chart);
  if (!isValidChart(chart)) return { ok: false, error: 'The chart in this file is damaged.' };
  if (!isValidCustomColors({ colors: data.customColors ?? [] })) {
    return { ok: false, error: 'The custom colours in this file are damaged.' };
  }
  if (!isValidOverrides(data.colorOverrides ?? {})) {
    return { ok: false, error: 'The colour edits in this file are damaged.' };
  }
  return { ok: true };
}

// A name that isn't used by any of my charts yet: "Name", "Name (2)", "Name (3)"…
function freeName(name) {
  const taken = new Set(listSavedCharts().map((chart) => chart.name));
  if (!taken.has(name)) return name;
  let n = 2;
  while (taken.has(`${name} (${n})`)) n++;
  return `${name} (${n})`;
}

// Adds a (checked) chart file as a NEW chart. It never replaces a chart.
// - Custom colours: one of mine with the same name and screen colour is used
//   if there is one; otherwise the colour is added as a new custom colour
//   (which also puts it in my stash).
// - Screen-colour edits: mine win. The file's edit is only used for Miyuki
//   colours I haven't edited.
// Returns { chart, addedColors, notInStash } or null if the chart couldn't be saved.
// notInStash: the Miyuki colours the chart uses that aren't in my stash for its bead size.
export function importChartFile(data) {
  const chart = upgradeChart({ id: 'imported', ...data.chart });

  // Custom colours: the file's id → the id in this browser.
  const newIds = new Map();
  let addedColors = 0;
  for (const color of data.customColors ?? []) {
    const mine = findCustomColor(color.name, color.hex);
    if (mine) {
      newIds.set(color.id, mine.id);
    } else {
      const added = addCustomColor({ name: color.name, hex: color.hex, sizes: color.sizes, code: color.code, notes: color.notes });
      newIds.set(color.id, added.id);
      addedColors++;
    }
  }
  const newId = (id) => (id !== null && newIds.has(id) ? newIds.get(id) : id);

  // Screen-colour edits I don't have yet.
  for (const [id, hex] of Object.entries(data.colorOverrides ?? {})) {
    if (getColor(id) && !getColor(id).custom && !getColorOverride(id)) setColorOverride(id, hex);
  }

  const now = Date.now();
  const imported = {
    ...chart,
    id: crypto.randomUUID(),
    name: freeName(chart.name.trim() || 'Imported chart'),
    beads: chart.beads.map((row) => row.map(newId)),
    backgroundBead: newId(chart.backgroundBead),
    createdAt: now,
    updatedAt: now,
  };
  if (!saveChart(imported)) return null;

  const notInStash = [...colorIdsUsed(imported)]
    .map(getColor)
    .filter((color) => color && !color.custom && !isInStash(color.id, imported.beadSize));
  return { chart: imported, addedColors, notInStash };
}
