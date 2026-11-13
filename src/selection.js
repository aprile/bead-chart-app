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
// (e.g. after the chart got smaller).
export function clampRect(rect, { rows, cols }) {
  const clamped = {
    top: rect.top,
    left: rect.left,
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
