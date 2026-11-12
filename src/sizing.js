// Measurement maths: finished size (mm) → bead count → real finished size (mm).
// Everything here is in millimetres.

import { getCalibration } from './calibration.js';
import { getStitch, specSpacing } from './stitches/index.js';

// How much space one bead takes up in the chart, depending on the stitch.
// Uses my calibration measurement if I've entered one, otherwise the spec.
// (Every part of the app gets its bead sizes from here.)
export function beadSpacing(stitch, beadSize) {
  const spec = specSpacing(stitch, beadSize);
  const calibration = getCalibration(stitch, beadSize);
  return {
    columnWidth: calibration?.mmPerColumn ?? spec.columnWidth,
    rowHeight: calibration?.mmPerRow ?? spec.rowHeight,
  };
}

// The real finished size of a chart with this many columns and rows.
export function realSize({ stitch, beadSize, cols, rows }) {
  const { columnWidth, rowHeight } = beadSpacing(stitch, beadSize);
  // Offset beads stick out (e.g. brick stitch is half a bead wider), and
  // the finished size includes that overhang.
  const { overhang } = getStitch(stitch);
  return {
    realWidthMm: (cols + overhang.across) * columnWidth,
    realHeightMm: (rows + overhang.down) * rowHeight,
  };
}

// Turn a wanted size into a bead count, plus the real size after rounding.
export function calculateChartSize({ stitch, beadSize, widthMm, heightMm }) {
  const { columnWidth, rowHeight } = beadSpacing(stitch, beadSize);
  const { overhang } = getStitch(stitch);

  // Math.max(1, ...) makes sure there's always at least 1 column and 1 row.
  const cols = Math.max(1, Math.round(widthMm / columnWidth - overhang.across));
  const rows = Math.max(1, Math.round(heightMm / rowHeight - overhang.down));

  return { cols, rows, ...realSize({ stitch, beadSize, cols, rows }) };
}

export const MM_PER_UNIT = { mm: 1, cm: 10 };

// Show a mm value in a unit, e.g. 20.4 mm → "2.04 cm".
export function formatLength(mm, unit) {
  const value = mm / MM_PER_UNIT[unit];
  // toFixed(2) gives 2 decimals; Number(...) drops trailing zeros (2.50 → 2.5).
  return `${Number(value.toFixed(2))} ${unit}`;
}
