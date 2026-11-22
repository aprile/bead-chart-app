// Two-drop peyote: like flat peyote, but every stitch adds two beads side by
// side. So the columns go in pairs: the two columns of a pair sit level, and
// each pair is shifted half a bead up or down from the next.
// See index.js for what each part means, and peyote.js for plain peyote.
//
// How the chart's rows and columns map to peyote rows (as in plain peyote,
// but with pairs of columns instead of single columns):
// - Pairs are counted from the RIGHT. Pairs sit either LOW or HIGH (half a
//   bead higher); the rightmost pair is always low, because rows 1 + 2 are
//   picked up together from the left and the last beads strung drop into row 1.
// - With an odd number of columns, the leftmost "pair" is a single column.
// - Peyote row 1 = the bottom beads of every low pair, row 2 = the bottom
//   beads of every high pair, row 3 = the 2nd beads of every low pair, and so
//   on. So each chart row (counted from the bottom) holds two peyote rows.

import { rowLabel } from './reading-order.js';

// 0 = the rightmost pair.
function pairOf(col, cols) {
  return Math.floor((cols - 1 - col) / 2);
}

function isLowColumn(col, cols) {
  return pairOf(col, cols) % 2 === 0;
}

export default {
  id: 'peyote2',
  label: 'Two-drop peyote',

  // Holes run sideways, like peyote.
  holes: 'horizontal',

  // The high pairs stick out half a bead, so the height includes it.
  overhang: { across: 0, down: 0.5 },

  // No grid lines: the shifted pairs don't line up with them.
  gridLines: false,

  calibrationAcross: 'columns across',
  calibrationDown: 'beads in one column',

  // Until I measure two-drop peyote, it uses my flat peyote values.
  calibrationFrom: 'peyote',

  // Rows count from the top, so "low" means shifted DOWN half a bead.
  cellOffset(row, col, { cols }) {
    return { x: 0, y: isLowColumn(col, cols) ? 0.5 : 0 };
  },

  // Zig-zag rows, going up. Rows 1 + 2 are picked up together, left to
  // right (every bead of the bottom chart row): that's the first working
  // row. Then each peyote row is every other pair: row 3 right to left along
  // the low pairs, row 4 left to right along the high pairs, and so on. Each
  // stitch picks up the two beads of a pair, in the direction of travel.
  workRows(cols, rows) {
    const bottom = rows - 1;
    const first = [];
    for (let col = 0; col < cols; col++) first.push({ row: bottom, col });
    // With only one pair there's no zig-zag: those beads are peyote row 1.
    const zigZag = pairOf(0, cols) > 0;
    const workRows = [{ beads: first, label: zigZag ? rowLabel(1, 2) : rowLabel(1), last: zigZag ? 2 : 1 }];

    for (let peyoteRow = 3; peyoteRow <= rows * 2; peyoteRow++) {
      const row = bottom - Math.floor((peyoteRow - 1) / 2);
      const low = peyoteRow % 2 === 1; // odd peyote rows are in the low pairs
      const rightToLeft = peyoteRow % 2 === 1;
      const beads = [];
      for (let i = 0; i < cols; i++) {
        const col = rightToLeft ? cols - 1 - i : i;
        if (isLowColumn(col, cols) === low) beads.push({ row, col });
      }
      if (beads.length > 0) workRows.push({ beads, label: rowLabel(peyoteRow), last: peyoteRow });
    }
    return workRows;
  },
};
