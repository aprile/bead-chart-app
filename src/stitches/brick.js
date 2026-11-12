// Brick stitch: holes run up and down, and every other row is shifted
// half a bead to the right. See index.js for what each part means.

export default {
  id: 'brick',
  label: 'Brick stitch',

  // Holes run up and down: a column is as wide as the bead's diameter.
  holes: 'vertical',

  // The shifted rows stick out half a bead, so the width includes it.
  overhang: { across: 0.5, down: 0 },

  // No grid lines: the shifted rows don't line up with them.
  gridLines: false,

  calibrationAcross: 'beads in one row',

  // Rows are counted from the top of the chart (row 0 = top row).
  // Odd rows (the 2nd, 4th… from the top) are shifted right by half a bead.
  cellOffset(row) {
    return { x: row % 2 === 1 ? 0.5 : 0, y: 0 };
  },

  // Row by row, going up from the bottom, alternating direction:
  // the bottom row left to right, the next right to left, and so on.
  readingOrder(cols, rows) {
    const order = [];
    for (let row = rows - 1; row >= 0; row--) {
      const leftToRight = (rows - 1 - row) % 2 === 0;
      for (let i = 0; i < cols; i++) order.push({ row, col: leftToRight ? i : cols - 1 - i });
    }
    return order;
  },
};
