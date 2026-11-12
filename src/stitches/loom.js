// Loom stitch: a straight grid, with the holes running sideways.
// See index.js for what each part of a stitch module means.

export default {
  id: 'loom',
  label: 'Loom',

  // Holes run sideways: a column is as wide as the bead's thickness.
  holes: 'horizontal',

  // Extra beads the finished piece sticks out by (none for loom).
  overhang: { across: 0, down: 0 },

  // Lines between the rows and columns can be drawn.
  gridLines: true,

  // Words for the calibration screen: what I count across one row.
  calibrationAcross: 'beads side by side in one row',

  // Every bead sits straight on the grid.
  cellOffset() {
    return { x: 0, y: 0 };
  },

  // Row by row, going up from the bottom. Each row is one pick-up, left to right.
  readingOrder(cols, rows) {
    const order = [];
    for (let row = rows - 1; row >= 0; row--) {
      for (let col = 0; col < cols; col++) order.push({ row, col });
    }
    return order;
  },
};
