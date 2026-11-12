// All the stitches the app knows. Everything stitch-specific lives in a
// stitch module; the rest of the app asks the module and never checks
// which stitch it is.
//
// Every stitch module has the same parts:
// - id, label           e.g. 'brick', 'Brick stitch'
// - holes               'horizontal' or 'vertical': which way the holes run.
//                       This sets the column width and row height (see specSpacing).
// - overhang            { across, down }: extra beads the piece sticks out by
//                       because of offsets, e.g. brick is half a bead wider.
// - gridLines           true if lines between rows and columns make sense
// - calibrationAcross   words for the calibration screen ("20 … = 41 mm")
// - calibrationDown     (optional) the same for the height; 'rows' if left out
// - calibrationFrom     (optional) another stitch's id: until I calibrate this
//                       stitch, it uses that stitch's values instead of the spec
// - cellOffset(row, col, { rows, cols })  how far bead (row, col) is shifted
//                       from the plain grid, in beads: { x, y }. Rows count from
//                       the TOP; the chart's size is there for counting from the
//                       bottom or the right.
// - readingOrder(cols, rows)  every bead in the order it's stitched,
//                       starting bottom left: [{ row, col }, …]
//
// To add a stitch: write its module and add it to the list below.

import { BEAD_SIZES } from '../beads.js';
import loom from './loom.js';
import square from './square.js';
import brick from './brick.js';
import brick2 from './brick2.js';
import peyote from './peyote.js';

// In the order they're shown in the "Stitch" choice.
export const STITCHES = [loom, square, brick, brick2, peyote];

export function getStitch(id) {
  return STITCHES.find((stitch) => stitch.id === id) ?? null;
}

export function isStitch(id) {
  return getStitch(id) !== null;
}

// Bead spacing from the published specs (see PLAN.md), in mm.
// Holes sideways: a column is as wide as the bead's thickness.
// Holes up and down: a column is as wide as the bead's diameter.
export function specSpacing(stitchId, beadSize) {
  const bead = BEAD_SIZES[beadSize];
  if (getStitch(stitchId).holes === 'horizontal') {
    return { columnWidth: bead.thickness, rowHeight: bead.diameter };
  }
  return { columnWidth: bead.diameter, rowHeight: bead.thickness };
}
