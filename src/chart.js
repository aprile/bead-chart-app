// The chart data (which colour is in each bead) and the undo/redo history.
// No drawing happens here: grid.js does that.
//
// Chart shape (from PLAN-V2.md, plus an id and dates for saving):
// { id, version: 2, name, stitch, beadSize, widthMm, heightMm, cols, rows,
//   beads: [[color id or null, ...], ...],   ← beads[row][col], null = empty
//   backgroundBead,                           ← colour id every empty bead is stitched in, or null
//   createdAt, updatedAt }                    ← times in milliseconds
// Older (v1) charts are upgraded when they're loaded: see migrate.js.

import { CHART_VERSION } from './migrate.js';
import { countBeadsOf, replaceColorIn } from './chart-colors.js';
import { getStitch } from './stitches/index.js';
import { shapeAt, keepsShape } from './selection.js';

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
    version: CHART_VERSION,
    name,
    stitch: settings.stitch,
    beadSize: settings.beadSize,
    widthMm: settings.widthMm,
    heightMm: settings.heightMm,
    cols: settings.cols,
    rows: settings.rows,
    beads: emptyBeads(settings.cols, settings.rows),
    backgroundBead: null,
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
  // Keep the beads that still fit, anchored at the BOTTOM LEFT (row 1,
  // column 1), where the work starts. Rows and columns are added or cut at
  // the top and right.
  const at = resizedPosition(base, settings);
  const beads = emptyBeads(settings.cols, settings.rows).map((row, r) =>
    row.map((_, c) => base.beads[r - at.row]?.[c - at.col] ?? null),
  );
  chart = { ...base, ...settings, name: chart.name, beads };
  notify();
}

// Where the old beads go in the resized chart: the row and column (in the new
// chart) of the old top-left bead. Normally that keeps the bottom-left corner
// in place. But on stitches with half-bead offsets (e.g. brick, where the
// shift depends on the number of rows), that could change the design's shape.
// Then we move it by a row or column (up to 3 for two-drop brick) to where the
// shape stays the same (the same check as pasting, see selection.js),
// choosing the move that cuts off the fewest painted beads, then the smallest move.
function resizedPosition(base, settings) {
  const bottomLeft = { row: settings.rows - base.rows, col: 0 };
  const stitch = getStitch(settings.stitch);
  if (stitch !== getStitch(base.stitch)) return bottomLeft; // a different stitch can't keep the shape anyway
  const piece = { rows: base.rows, cols: base.cols, shape: shapeAt(stitch, base, 0, 0, base.rows, base.cols) };

  // How many painted beads would end up off the new chart.
  const countIn = paintedCounter(base.beads);
  const total = countIn(0, 0, base.rows, base.cols);
  const cut = ({ row, col }) => {
    // the old rows and columns that still fit
    const top = Math.max(-row, 0);
    const bottom = Math.min(settings.rows - row, base.rows);
    const left = Math.max(-col, 0);
    const right = Math.min(settings.cols - col, base.cols);
    return total - (bottom > top && right > left ? countIn(top, left, bottom, right) : 0);
  };

  let best = null;
  for (let dr = -3; dr <= 3; dr++) {
    for (let dc = -3; dc <= 3; dc++) {
      const at = { row: bottomLeft.row + dr, col: bottomLeft.col + dc };
      if (!keepsShape(stitch, settings, piece, at)) continue;
      const score = [cut(at), Math.hypot(dr, dc)];
      if (!best || score[0] < best.score[0] || (score[0] === best.score[0] && score[1] < best.score[1])) {
        best = { at, score };
      }
    }
  }
  return best ? best.at : bottomLeft;
}

export function endResize() {
  // If the edit ended where it started, don't keep a useless undo step.
  if (resizeBase && sameSettings(resizeBase, chart) && undoStack.at(-1) === resizeBase) {
    undoStack.pop();
  }
  resizeBase = null;
}

// Returns countIn(top, left, bottom, right): how many beads are painted in
// rows top…bottom−1 and columns left…right−1. It adds up the whole chart once
// (a "running total" table), so each count afterwards is instant.
function paintedCounter(beads) {
  const rows = beads.length;
  const cols = beads[0]?.length ?? 0;
  // sums[r][c] = painted beads above row r and left of column c
  const sums = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      sums[r + 1][c + 1] = sums[r][c + 1] + sums[r + 1][c] - sums[r][c] + (beads[r][c] === null ? 0 : 1);
    }
  }
  return (top, left, bottom, right) => sums[bottom][right] - sums[top][right] - sums[bottom][left] + sums[top][left];
}

// ---- Colours used in the chart ----

// Includes the empty beads if this colour is the background bead.
export function countColor(colorId) {
  return countBeadsOf(chart, colorId);
}

// Swap one colour for another in the chart AND in the undo/redo history,
// so undo can never bring back a colour that's been deleted.
export function replaceColorEverywhere(oldId, newId) {
  endResize();
  for (const version of [chart, ...undoStack, ...redoStack]) replaceColorIn(version, oldId, newId);
  notify();
}

// ---- Background bead ----

// The colour every empty bead is stitched in (null = none). One undo step.
export function setBackgroundBead(colorId) {
  endResize();
  if (chart.backgroundBead === colorId) return;
  saveUndoStep(copyChart(chart));
  chart.backgroundBead = colorId;
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
