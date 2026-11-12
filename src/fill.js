// The fill tool: find all the beads joined to one bead that have the same
// colour (or are all empty), like a paint bucket.

import { neighbours } from './stitches/index.js';

// Returns [{ row, col }, …]: the start bead and every bead joined to it
// through beads of the same colour.
export function joinedArea(chart, row, col) {
  const target = chart.beads[row][col];
  const size = { rows: chart.rows, cols: chart.cols };
  const seen = new Set([`${row},${col}`]);
  const area = [];
  const toVisit = [{ row, col }];
  while (toVisit.length > 0) {
    const bead = toVisit.pop();
    area.push(bead);
    for (const next of neighbours(chart.stitch, bead.row, bead.col, size)) {
      const key = `${next.row},${next.col}`;
      if (seen.has(key) || chart.beads[next.row][next.col] !== target) continue;
      seen.add(key);
      toVisit.push(next);
    }
  }
  return area;
}
