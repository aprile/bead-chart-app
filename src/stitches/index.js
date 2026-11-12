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

// The beads that touch bead (row, col) along an edge, for any stitch.
// Worked out from where the stitch module places each bead: two beads are
// neighbours if their cells share an edge (not just a corner). So on loom
// it's up/down/left/right, and in brick or peyote a bead also touches the
// two half-shifted beads beside it. size = { rows, cols }.
export function neighbours(stitchId, row, col, size) {
  const stitch = getStitch(stitchId);
  const position = (r, c) => {
    const offset = stitch.cellOffset(r, c, size);
    return { x: c + offset.x, y: r + offset.y };
  };
  const here = position(row, col);
  const close = (a, b) => Math.abs(a - b) < 1e-6;
  const result = [];
  // Offsets are at most half a bead, so neighbours are always within one row/column.
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if ((r === row && c === col) || r < 0 || c < 0 || r >= size.rows || c >= size.cols) continue;
      const there = position(r, c);
      const dx = Math.abs(there.x - here.x);
      const dy = Math.abs(there.y - here.y);
      // Side by side (and overlapping up/down), or stacked (and overlapping sideways).
      const touching = (close(dx, 1) && dy < 1 - 1e-6) || (close(dy, 1) && dx < 1 - 1e-6);
      if (touching) result.push({ row: r, col: c });
    }
  }
  return result;
}
