// The chart data (which colour is in each bead) and the undo/redo history.
// No drawing happens here: grid.js does that.
//
// Chart shape (from PLAN.md, plus an id and dates for saving):
// { id, name, stitch, beadSize, widthMm, heightMm, cols, rows,
//   beads: [[color id or null, ...], ...],   ← beads[row][col], null = empty
//   createdAt, updatedAt }                    ← times in milliseconds

export const DEFAULT_NAME = 'Untitled chart';

const HISTORY_LIMIT = 100; // oldest steps are forgotten after this

let chart = null;
let undoStack = []; // earlier versions of the chart
let redoStack = []; // versions you undid, ready to redo

let strokeStart = null; // copy of the chart from when the current drag began
let strokeChanged = false;
let resizeBase = null; // copy of the chart from when the current form edit began

// Functions to call whenever the chart changes (autosave uses this).
const listeners = [];
export function onChange(listener) {
  listeners.push(listener);
}
function notify() {
  for (const listener of listeners) listener();
}

// A full copy, so later changes don't affect the saved version.
function copyChart(c) {
  return { ...c, beads: c.beads.map((row) => [...row]) };
}

function emptyBeads(cols, rows) {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

function saveUndoStep(snapshot) {
  undoStack.push(snapshot);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack = []; // a new change makes the old "redo" future invalid
}

function sameSettings(a, b) {
  return ['stitch', 'beadSize', 'widthMm', 'heightMm', 'cols', 'rows'].every((key) => a[key] === b[key]);
}

export function getChart() {
  return chart;
}

export function canUndo() {
  return undoStack.length > 0;
}

export function canRedo() {
  return redoStack.length > 0;
}

function resetHistory() {
  undoStack = [];
  redoStack = [];
  strokeStart = null;
  resizeBase = null;
}

// settings = { stitch, beadSize, widthMm, heightMm, cols, rows }
export function newChart(settings, name = DEFAULT_NAME) {
  const now = Date.now();
  chart = {
    id: crypto.randomUUID(), // a long random id, unique to this chart
    name,
    stitch: settings.stitch,
    beadSize: settings.beadSize,
    widthMm: settings.widthMm,
    heightMm: settings.heightMm,
    cols: settings.cols,
    rows: settings.rows,
    beads: emptyBeads(settings.cols, settings.rows),
    createdAt: now,
    updatedAt: now,
  };
  resetHistory();
}

// Open a saved chart. Its undo history starts empty.
export function openChart(saved) {
  chart = copyChart(saved);
  resetHistory();
}

// The name isn't part of undo: undoing a bead keeps the name you typed.
export function renameChart(name) {
  chart.name = name;
  notify();
}

// ---- Painting: one whole drag = one undo step ----

export function beginStroke() {
  endResize();
  strokeStart = copyChart(chart);
  strokeChanged = false;
}

// Returns true if the bead actually changed (so only that bead needs redrawing).
export function paintBead(row, col, colorId) {
  if (chart.beads[row][col] === colorId) return false;
  chart.beads[row][col] = colorId;
  strokeChanged = true;
  notify();
  return true;
}

export function endStroke() {
  if (strokeStart && strokeChanged) saveUndoStep(strokeStart);
  strokeStart = null;
}

// ---- Changing the size from the form ----
// While you type "18", the form briefly says "1". To avoid that wiping beads,
// every value during one edit is applied to the chart as it was when the edit
// began, and the whole edit is one undo step. The edit ends when you leave the
// field (or click a radio button, paint, undo…).

export function resizeChart(settings) {
  if (!resizeBase) {
    resizeBase = copyChart(chart);
    saveUndoStep(resizeBase);
  }
  const base = resizeBase;
  // Keep beads that still fit, anchored at the top left.
  const beads = emptyBeads(settings.cols, settings.rows).map((row, r) =>
    row.map((_, c) => base.beads[r]?.[c] ?? null),
  );
  chart = { ...base, ...settings, name: chart.name, beads };
  notify();
}

export function endResize() {
  // If the edit ended where it started, don't keep a useless undo step.
  if (resizeBase && sameSettings(resizeBase, chart) && undoStack.at(-1) === resizeBase) {
    undoStack.pop();
  }
  resizeBase = null;
}

// ---- Colours used in the chart ----

export function countColor(colorId) {
  return chart.beads.flat().filter((bead) => bead === colorId).length;
}

// Swap one colour for another in the chart AND in the undo/redo history,
// so undo can never bring back a colour that's been deleted.
export function replaceColorEverywhere(oldId, newId) {
  endResize();
  for (const version of [chart, ...undoStack, ...redoStack]) {
    for (const row of version.beads) {
      row.forEach((bead, col) => {
        if (bead === oldId) row[col] = newId;
      });
    }
  }
  notify();
}

// ---- Clear, undo, redo ----

export function isEmpty() {
  return chart.beads.every((row) => row.every((bead) => bead === null));
}

// Replace every bead at once (e.g. from a photo), as one undo step.
export function setAllBeads(beads) {
  endResize();
  saveUndoStep(copyChart(chart));
  chart.beads = beads.map((row) => [...row]);
  notify();
}

export function clearChart() {
  endResize();
  saveUndoStep(copyChart(chart));
  chart.beads = emptyBeads(chart.cols, chart.rows);
  notify();
}

export function undo() {
  endResize();
  if (!canUndo()) return false;
  const name = chart.name;
  redoStack.push(chart);
  chart = { ...undoStack.pop(), name };
  notify();
  return true;
}

export function redo() {
  endResize();
  if (!canRedo()) return false;
  const name = chart.name;
  undoStack.push(chart);
  chart = { ...redoStack.pop(), name };
  notify();
  return true;
}
