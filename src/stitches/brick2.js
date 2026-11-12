// Two-drop brick stitch: like brick stitch, but worked two rows at a time.
// Each pair of rows is stacked straight, and each pair is shifted half a
// bead from the next. See index.js for what each part means.

export default {
  id: 'brick2',
  label: 'Two-drop brick',

  // Holes run up and down, like brick stitch.
  holes: 'vertical',

  // The shifted pairs stick out half a bead, so the width includes it.
  overhang: { across: 0.5, down: 0 },

  gridLines: false,
  calibrationAcross: 'beads in one row',

  // Until I measure two-drop brick, it uses my brick stitch values.
  calibrationFrom: 'brick',

  // Pairs are counted from the BOTTOM, where work starts (rows 1 + 2 are
  // the first pair). With an odd number of rows, the top pair is a single row.
  // The bottom pair sits straight; every other pair is shifted right half a bead.
  cellOffset(row, col, rows) {
    const pair = Math.floor((rows - 1 - row) / 2); // 0 = bottom pair
    return { x: pair % 2 === 1 ? 0.5 : 0, y: 0 };
  },

  // Pair by pair, going up, alternating direction: the bottom pair left to
  // right, the next right to left, and so on. Each stitch adds two beads
  // stacked on top of each other: the top one is picked up first.
  readingOrder(cols, rows) {
    const order = [];
    for (let bottom = rows - 1, pair = 0; bottom >= 0; bottom -= 2, pair++) {
      const top = bottom - 1; // -1 means this "pair" is a single row (top of the chart)
      const leftToRight = pair % 2 === 0;
      for (let i = 0; i < cols; i++) {
        const col = leftToRight ? i : cols - 1 - i;
        if (top >= 0) order.push({ row: top, col });
        order.push({ row: bottom, col });
      }
    }
    return order;
  },
};
