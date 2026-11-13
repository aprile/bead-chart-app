// The marquee selection: a rectangle of beads, by rows and columns.
// { top, left, bottom, right } are bead indexes (inclusive), counted from the
// top left like chart.beads. On brick and peyote the shape on screen follows
// the beads (so its edges are stepped), but it's still a rectangle of rows × columns.

// The rectangle between two beads (e.g. where a drag started and where it is now).
export function rectBetween(a, b) {
  return {
    top: Math.min(a.row, b.row),
    bottom: Math.max(a.row, b.row),
    left: Math.min(a.col, b.col),
    right: Math.max(a.col, b.col),
  };
}

// Size in beads: { cols, rows }.
export function rectSize(rect) {
  return { cols: rect.right - rect.left + 1, rows: rect.bottom - rect.top + 1 };
}

// Every { row, col } in the rectangle.
export function beadsIn(rect) {
  const beads = [];
  for (let row = rect.top; row <= rect.bottom; row++) {
    for (let col = rect.left; col <= rect.right; col++) beads.push({ row, col });
  }
  return beads;
}

// The part of the rectangle that's inside a chart of this size, or null if none is
// (e.g. after the chart got smaller, or a pasted piece hanging off the edge).
export function clampRect(rect, { rows, cols }) {
  const clamped = {
    top: Math.max(rect.top, 0),
    left: Math.max(rect.left, 0),
    bottom: Math.min(rect.bottom, rows - 1),
    right: Math.min(rect.right, cols - 1),
  };
  return clamped.top <= clamped.bottom && clamped.left <= clamped.right ? clamped : null;
}

// A copy of the beads in the rectangle: { rows, cols, beads: [[colorId | null]] }.
export function copyBeads(chart, rect) {
  const beads = [];
  for (let row = rect.top; row <= rect.bottom; row++) beads.push(chart.beads[row].slice(rect.left, rect.right + 1));
  return { ...rectSize(rect), beads };
}

// ---------- Pasting: keeping the shape on stitches with offsets ----------
//
// On brick or peyote, rows (or columns) are shifted by half a bead. Moving a
// pasted piece by one row can flip those shifts and change its shape. So we
// record how the piece's beads are shifted compared to its top-left bead, and
// only allow positions where the shifts are the same. The shifts come from the
// stitch module (cellOffset), so this works for every stitch.

// The shifts of a piece placed at (top, left): one for each row (down its first
// column) and one for each column (along its first row), compared to the
// top-left bead. Beads outside the chart are null (not checked).
export function shapeAt(stitch, chart, top, left, rows, cols) {
  const base = stitch.cellOffset(top, left, chart);
  const inChart = (row, col) => row >= 0 && row < chart.rows && col >= 0 && col < chart.cols;
  const shift = (row, col) => {
    if (!inChart(row, col)) return null;
    const offset = stitch.cellOffset(row, col, chart);
    return `${offset.x - base.x},${offset.y - base.y}`;
  };
  return {
    down: Array.from({ length: rows }, (_, r) => shift(top + r, left)),
    across: Array.from({ length: cols }, (_, c) => shift(top, left + c)),
  };
}

function sameShape(a, b) {
  const same = (x, y) => x.every((value, i) => value === null || y[i] === null || value === y[i]);
  return same(a.down, b.down) && same(a.across, b.across);
}

// The allowed position nearest to `wanted` ({ row, col }) for a piece with
// this shape. Tries positions up to 3 beads away (two-drop brick repeats every
// 4 rows). If none keeps the shape (e.g. a brick piece on a loom chart), the
// piece goes where it was wanted.
export function snapPosition(stitch, chart, piece, wanted) {
  const tries = [];
  for (let dr = -3; dr <= 3; dr++) {
    for (let dc = -3; dc <= 3; dc++) tries.push({ dr, dc, distance: Math.hypot(dr, dc) });
  }
  tries.sort((a, b) => a.distance - b.distance);
  for (const { dr, dc } of tries) {
    const row = wanted.row + dr;
    const col = wanted.col + dc;
    if (sameShape(piece.shape, shapeAt(stitch, chart, row, col, piece.rows, piece.cols))) return { row, col };
  }
  return wanted;
}
