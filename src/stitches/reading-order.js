// Reading orders shared by several stitches. Rows are counted from the
// TOP of the chart (row 0 = top row), but work starts at the bottom left.

// Row by row, going up from the bottom.
// alternate: false → every row left to right (loom: each row is one pick-up).
// alternate: true  → the bottom row left to right, the next right to left, and so on.
export function rowByRow(cols, rows, { alternate }) {
  const order = [];
  for (let row = rows - 1; row >= 0; row--) {
    const rowsDone = rows - 1 - row;
    const leftToRight = !alternate || rowsDone % 2 === 0;
    for (let i = 0; i < cols; i++) order.push({ row, col: leftToRight ? i : cols - 1 - i });
  }
  return order;
}
