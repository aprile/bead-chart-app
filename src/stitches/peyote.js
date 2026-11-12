// Flat peyote stitch: holes run sideways, and every other column is shifted
// half a bead up or down. See index.js for what each part means.
//
// How the chart's rows and columns map to peyote rows:
// - Columns sit either LOW or HIGH (half a bead higher). The rightmost
//   column is always low: rows 1 + 2 are picked up together from the left,
//   so the last bead strung (on the right) drops down into row 1.
// - Peyote row 1 = the bottom bead of every low column, row 2 = the bottom
//   bead of every high column, row 3 = the 2nd bead of every low column, and
//   so on. So each chart row (counted from the bottom) holds two peyote rows.

function isLowColumn(col, cols) {
  return (cols - 1 - col) % 2 === 0;
}

export default {
  id: 'peyote',
  label: 'Flat peyote',

  // Holes run sideways, like loom.
  holes: 'horizontal',

  // The high columns stick out half a bead, so the height includes it.
  overhang: { across: 0, down: 0.5 },

  // No grid lines: the shifted columns don't line up with them.
  gridLines: false,

  calibrationAcross: 'columns across',
  calibrationDown: 'beads in one column',

  // Rows count from the top, so "low" means shifted DOWN half a bead.
  cellOffset(row, col, { cols }) {
    return { x: 0, y: isLowColumn(col, cols) ? 0.5 : 0 };
  },

  // Zig-zag rows, going up. Rows 1 + 2 are picked up together, left to
  // right (every bead of the bottom chart row). Then each peyote row is
  // every other bead: row 3 right to left along the low columns, row 4
  // left to right along the high columns, and so on.
  readingOrder(cols, rows) {
    const order = [];
    const bottom = rows - 1;
    for (let col = 0; col < cols; col++) order.push({ row: bottom, col });

    for (let peyoteRow = 3; peyoteRow <= rows * 2; peyoteRow++) {
      const row = bottom - Math.floor((peyoteRow - 1) / 2);
      const low = peyoteRow % 2 === 1; // odd peyote rows are in the low columns
      const rightToLeft = peyoteRow % 2 === 1;
      for (let i = 0; i < cols; i++) {
        const col = rightToLeft ? cols - 1 - i : i;
        if (isLowColumn(col, cols) === low) order.push({ row, col });
      }
    }
    return order;
  },
};
