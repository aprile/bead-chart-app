// Measurement maths: finished size (mm) → bead count → real finished size (mm).
// Everything here is in millimetres.

import { BEAD_SIZES } from './beads.js';

// How much space one bead takes up in the chart, depending on the stitch.
// Loom: holes run sideways, so a column is as wide as the bead's thickness.
// Brick: holes run up and down, so a column is as wide as the bead's diameter.
export function beadSpacing(stitch, beadSize) {
  const bead = BEAD_SIZES[beadSize];
  if (stitch === 'loom') {
    return { columnWidth: bead.thickness, rowHeight: bead.diameter };
  }
  return { columnWidth: bead.diameter, rowHeight: bead.thickness };
}

// Turn a wanted size into a bead count, plus the real size after rounding.
export function calculateChartSize({ stitch, beadSize, widthMm, heightMm }) {
  const { columnWidth, rowHeight } = beadSpacing(stitch, beadSize);

  // Brick stitch: every other row is shifted half a bead, so the
  // finished width is (columns + 0.5) beads wide.
  const overhang = stitch === 'brick' ? 0.5 : 0;

  // Math.max(1, ...) makes sure there's always at least 1 column and 1 row.
  const cols = Math.max(1, Math.round(widthMm / columnWidth - overhang));
  const rows = Math.max(1, Math.round(heightMm / rowHeight));

  return {
    cols,
    rows,
    realWidthMm: (cols + overhang) * columnWidth,
    realHeightMm: rows * rowHeight,
  };
}
