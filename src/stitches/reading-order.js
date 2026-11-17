// Working rows shared by several stitches. Rows are counted from the
// TOP of the chart (row 0 = top row), but work starts at the bottom left.
// See workRows in index.js for what each working row holds.

// "Row 3", or "Rows 1 & 2" for two rows worked together.
export function rowLabel(first, last = first) {
  return first === last ? `Row ${first}` : `Rows ${first} & ${last}`;
}

// Row by row, going up from the bottom.
// alternate: false → every row left to right (loom: each row is one pick-up).
// alternate: true  → the bottom row left to right, the next right to left, and so on.
export function rowByRow(cols, rows, { alternate }) {
  const workRows = [];
  for (let row = rows - 1; row >= 0; row--) {
    const number = rows - row; // 1 = bottom row
    const leftToRight = !alternate || number % 2 === 1;
    const beads = [];
    for (let i = 0; i < cols; i++) beads.push({ row, col: leftToRight ? i : cols - 1 - i });
    workRows.push({ beads, label: rowLabel(number), last: number });
  }
  return workRows;
}
