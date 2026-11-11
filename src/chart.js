// The chart data (which colour is in each bead) and the undo/redo history.
// No drawing happens here: grid.js does that.
//
// Chart shape (from PLAN.md):
// { name, stitch, beadSize, widthMm, heightMm, cols, rows,
//   beads: [[color id or null, ...], ...] }   ← beads[row][col], null = empty

const HISTORY_LIMIT = 100; // oldest steps are forgotten after this

let chart = null;
let undoStack = []; // earlier versions of the chart
let redoStack = []; // versions you undid, ready to redo

let strokeStart = null; // copy of the chart from when the current drag began
let strokeChanged = false;
let resizeBase = null; // copy of the chart from when the current form edit began

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

// settings = { stitch, beadSize, widthMm, heightMm, cols, rows }
export function newChart(settings) {
  chart = { name: 'Untitled chart', ...settings, beads: emptyBeads(settings.cols, settings.rows) };
  undoStack = [];
  redoStack = [];
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
  chart = { ...base, ...settings, beads };
}

export function endResize() {
  // If the edit ended where it started, don't keep a useless undo step.
  if (resizeBase && sameSettings(resizeBase, chart) && undoStack.at(-1) === resizeBase) {
    undoStack.pop();
  }
  resizeBase = null;
}

// ---- Clear, undo, redo ----

export function isEmpty() {
  return chart.beads.every((row) => row.every((bead) => bead === null));
}

export function clearChart() {
  endResize();
  saveUndoStep(copyChart(chart));
  chart.beads = emptyBeads(chart.cols, chart.rows);
}

export function undo() {
  endResize();
  if (!canUndo()) return false;
  redoStack.push(chart);
  chart = undoStack.pop();
  return true;
}

export function redo() {
  endResize();
  if (!canRedo()) return false;
  undoStack.push(chart);
  chart = redoStack.pop();
  return true;
}
