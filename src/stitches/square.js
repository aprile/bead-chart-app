// Square stitch: looks like loom (a straight grid, holes running sideways),
// but it's stitched row by row in alternating directions.
// See index.js for what each part means.

import { rowByRow } from './reading-order.js';

export default {
  id: 'square',
  label: 'Square stitch',

  holes: 'horizontal',
  overhang: { across: 0, down: 0 },
  gridLines: true,
  calibrationAcross: 'beads side by side in one row',

  // Until I measure square stitch, it uses my loom values.
  calibrationFrom: 'loom',

  cellOffset() {
    return { x: 0, y: 0 };
  },

  readingOrder(cols, rows) {
    return rowByRow(cols, rows, { alternate: true });
  },
};
