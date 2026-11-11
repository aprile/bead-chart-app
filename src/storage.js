// Everything about saving: localStorage, saved charts, and the backup file.

import { BEAD_SIZES } from './beads.js';

// All localStorage keys start with this, so they don't mix with anything else.
const PREFIX = 'bead-chart-app.';
const CHART_PREFIX = `${PREFIX}chart.`; // one key per chart: bead-chart-app.chart.<id>

export const STORAGE_KEYS = {
  stash: `${PREFIX}stash`,
  customColors: `${PREFIX}customColors`,
  overrides: `${PREFIX}colorOverrides`,
  lastChoices: `${PREFIX}lastChoices`,
  currentChartId: `${PREFIX}currentChart`,
};

// ---------- Basic read/write ----------
// If localStorage fails (private window, storage full…), the app keeps
// working. save() returns false so we can tell you it didn't save.

export function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (error) {
    console.warn(`Could not load ${key}:`, error);
    return null;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Could not save ${key}:`, error);
    return false;
  }
}

function allKeys() {
  try {
    return Object.keys(localStorage);
  } catch {
    return [];
  }
}

// ---------- Checking data is the right shape ----------

const HEX = /^#[0-9a-f]{6}$/i;
const SIZE_NAMES = Object.keys(BEAD_SIZES);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function isValidChart(chart) {
  return (
    isObject(chart) &&
    typeof chart.id === 'string' &&
    typeof chart.name === 'string' &&
    ['loom', 'brick'].includes(chart.stitch) &&
    Object.hasOwn(BEAD_SIZES, chart.beadSize) &&
    isPositiveNumber(chart.widthMm) &&
    isPositiveNumber(chart.heightMm) &&
    Number.isInteger(chart.cols) && chart.cols > 0 &&
    Number.isInteger(chart.rows) && chart.rows > 0 &&
    Array.isArray(chart.beads) &&
    chart.beads.length === chart.rows &&
    chart.beads.every(
      (row) =>
        Array.isArray(row) &&
        row.length === chart.cols &&
        row.every((bead) => bead === null || typeof bead === 'string'),
    )
  );
}

function isValidStash(stash) {
  return (
    isObject(stash) &&
    SIZE_NAMES.every(
      (size) => stash[size] === undefined || (Array.isArray(stash[size]) && stash[size].every((id) => typeof id === 'string')),
    )
  );
}

function isValidCustomColors(custom) {
  return (
    isObject(custom) &&
    Array.isArray(custom.colors) &&
    custom.colors.every(
      (color) =>
        isObject(color) &&
        /^custom-\d+$/.test(color.id) &&
        typeof color.name === 'string' &&
        HEX.test(color.hex) &&
        Array.isArray(color.sizes) &&
        color.sizes.length > 0 &&
        color.sizes.every((size) => SIZE_NAMES.includes(size)),
    )
  );
}

function isValidOverrides(overrides) {
  return isObject(overrides) && Object.values(overrides).every((hex) => HEX.test(hex));
}

// ---------- Saved charts ----------

// All saved charts, most recently changed first.
export function listSavedCharts() {
  return allKeys()
    .filter((key) => key.startsWith(CHART_PREFIX))
    .map(load)
    .filter(isValidChart) // a damaged chart is skipped rather than crashing the app
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export function loadSavedChart(id) {
  if (typeof id !== 'string') return null;
  const chart = load(CHART_PREFIX + id);
  return isValidChart(chart) ? chart : null;
}

export function saveChart(chart) {
  return save(CHART_PREFIX + chart.id, chart);
}

export function deleteSavedChart(id) {
  try {
    localStorage.removeItem(CHART_PREFIX + id);
  } catch (error) {
    console.warn('Could not delete chart:', error);
  }
}

export function getCurrentChartId() {
  return load(STORAGE_KEYS.currentChartId);
}

export function setCurrentChartId(id) {
  save(STORAGE_KEYS.currentChartId, id);
}

function countIn(chart, colorId) {
  return chart.beads.flat().filter((bead) => bead === colorId).length;
}

// How many beads of a colour are in the saved charts (except one, usually the open chart).
export function countColorInSavedCharts(colorId, exceptId) {
  let beads = 0;
  let charts = 0;
  for (const chart of listSavedCharts()) {
    if (chart.id === exceptId) continue;
    const count = countIn(chart, colorId);
    if (count > 0) {
      beads += count;
      charts++;
    }
  }
  return { beads, charts };
}

export function replaceColorInSavedCharts(oldId, newId, exceptId) {
  for (const chart of listSavedCharts()) {
    if (chart.id === exceptId || countIn(chart, oldId) === 0) continue;
    chart.beads = chart.beads.map((row) => row.map((bead) => (bead === oldId ? newId : bead)));
    chart.updatedAt = Date.now();
    saveChart(chart);
  }
}

// ---------- Backup file ----------

export const BACKUP_VERSION = 1;

export function makeBackup() {
  return {
    app: 'bead-chart-app',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    currentChartId: getCurrentChartId(),
    charts: listSavedCharts(),
    stash: load(STORAGE_KEYS.stash) ?? {},
    customColors: load(STORAGE_KEYS.customColors) ?? { nextNumber: 1, colors: [] },
    colorOverrides: load(STORAGE_KEYS.overrides) ?? {},
  };
}

// e.g. bead-charts-backup-2026-11-11.json (today's date where you are)
function backupFileName(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `bead-charts-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

// Makes the browser download the backup as a file. Returns the backup.
export function downloadBackup() {
  const backup = makeBackup();
  const file = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = backupFileName();
  link.click();
  URL.revokeObjectURL(link.href);
  return backup;
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

// A short description, e.g. "12 charts, 85 stash colours (11/0: 60, 15/0: 25), …"
export function describeData(data) {
  const perSize = SIZE_NAMES.map((size) => `${size}: ${data.stash[size]?.length ?? 0}`).join(', ');
  const stashTotal = SIZE_NAMES.reduce((sum, size) => sum + (data.stash[size]?.length ?? 0), 0);
  return [
    plural(data.charts.length, 'chart'),
    `${plural(stashTotal, 'stash colour')} (${perSize})`,
    plural(data.customColors.colors.length, 'custom colour'),
    plural(Object.keys(data.colorOverrides).length, 'colour edit'),
  ].join(', ');
}

export function describeCurrentData() {
  return describeData(makeBackup());
}

// Checks a backup file's contents. Returns { ok: true, summary } or { ok: false, error }.
export function checkBackup(data) {
  if (!isObject(data) || data.app !== 'bead-chart-app') {
    return { ok: false, error: "This isn't a Bead Chart backup file." };
  }
  if (!Number.isInteger(data.version) || data.version < 1) {
    return { ok: false, error: 'This backup has no valid version number.' };
  }
  if (data.version > BACKUP_VERSION) {
    return { ok: false, error: 'This backup was made by a newer version of the app.' };
  }
  if (!Array.isArray(data.charts)) return { ok: false, error: 'The backup has no chart list.' };
  const broken = data.charts.findIndex((chart) => !isValidChart(chart));
  if (broken !== -1) return { ok: false, error: `Chart number ${broken + 1} in the backup is damaged.` };
  if (!isValidStash(data.stash)) return { ok: false, error: 'The stash in the backup is damaged.' };
  if (!isValidCustomColors(data.customColors)) return { ok: false, error: 'The custom colours in the backup are damaged.' };
  if (!isValidOverrides(data.colorOverrides)) return { ok: false, error: 'The colour edits in the backup are damaged.' };
  return { ok: true, summary: describeData(data) };
}

// Replace all my data with a (checked) backup. Returns true if it worked.
// If it fails halfway (e.g. storage full), the old data is put back.
export function restoreBackup(data) {
  // lastChoices is just a form preference, so it's kept.
  const keysToReplace = allKeys().filter((key) => key.startsWith(PREFIX) && key !== STORAGE_KEYS.lastChoices);
  const oldValues = keysToReplace.map((key) => [key, localStorage.getItem(key)]);

  try {
    keysToReplace.forEach((key) => localStorage.removeItem(key));
    for (const chart of data.charts) {
      localStorage.setItem(CHART_PREFIX + chart.id, JSON.stringify(chart));
    }
    localStorage.setItem(STORAGE_KEYS.stash, JSON.stringify(data.stash));
    localStorage.setItem(STORAGE_KEYS.customColors, JSON.stringify(data.customColors));
    localStorage.setItem(STORAGE_KEYS.overrides, JSON.stringify(data.colorOverrides));
    const current = data.charts.some((chart) => chart.id === data.currentChartId)
      ? data.currentChartId
      : data.charts[0]?.id ?? null;
    localStorage.setItem(STORAGE_KEYS.currentChartId, JSON.stringify(current));
    return true;
  } catch (error) {
    console.warn('Import failed, putting the old data back:', error);
    try {
      allKeys()
        .filter((key) => key.startsWith(PREFIX) && key !== STORAGE_KEYS.lastChoices)
        .forEach((key) => localStorage.removeItem(key));
      oldValues.forEach(([key, value]) => localStorage.setItem(key, value));
    } catch (restoreError) {
      console.error('Could not put the old data back:', restoreError);
    }
    return false;
  }
}
