// Draws the bead chart on a <canvas>, and works out which bead is at a point.
// Bead proportions come from sizing.js (which reads the dimensions in beads.js).
//
// The canvas only covers the VISIBLE part of the chart (chart-view.js handles
// scrolling and zoom). So it's never huge, and stays sharp at any zoom.

import { beadSpacing } from './sizing.js';
import { getColor, isMissingColor } from './colors.js';

// The starting bead size, measured on the bead's shorter side, in CSS pixels.
// MIN stops long charts (bracelets) shrinking to dots: you scroll instead.
// MAX stops tiny charts turning into giant beads.
const MIN_BEAD_PX = 14;
const MAX_BEAD_PX = 48;

const EMPTY_FILL = '#d6d4d9';
const BEAD_EDGE = '#b3b0b8';
// A colour that no longer exists: white with a red cross, easy to spot.
const MISSING_FILL = '#ffffff';
const MISSING_MARK = '#d32f2f';

// ---------- Sizes ----------

// The chart's real size in mm (brick includes the half-bead overhang).
export function chartSizeMm(chart) {
  const { columnWidth, rowHeight } = beadSpacing(chart.stitch, chart.beadSize);
  const isBrick = chart.stitch === 'brick';
  return {
    isBrick,
    columnWidth,
    rowHeight,
    smallerMm: Math.min(columnWidth, rowHeight),
    widthMm: (chart.cols + (isBrick ? 0.5 : 0)) * columnWidth,
    heightMm: chart.rows * rowHeight,
  };
}

// Pixels per mm so the whole chart fits in the space.
export function fitScale(chart, availWidth, availHeight) {
  const size = chartSizeMm(chart);
  return Math.min(availWidth / size.widthMm, availHeight / size.heightMm);
}

// The starting zoom ("100%"): fit if possible, but beads never smaller than
// MIN_BEAD_PX or bigger than MAX_BEAD_PX.
export function autoScale(chart, availWidth, availHeight) {
  const { smallerMm } = chartSizeMm(chart);
  const fit = fitScale(chart, availWidth, availHeight);
  return Math.min(Math.max(fit, MIN_BEAD_PX / smallerMm), MAX_BEAD_PX / smallerMm);
}

// Everything the drawing needs to know, in CSS pixels.
// originX/Y: where the chart's top-left corner is on the canvas (moves as you scroll).
// clipX/Y: beads are hidden left of / above this (that's where the numbers go).
export function makeLayout(chart, scale, { originX, originY, clipX, clipY, gridLines, numbers }) {
  const { columnWidth, rowHeight, isBrick } = chartSizeMm(chart);
  const beadW = columnWidth * scale;
  const beadH = rowHeight * scale;
  const smaller = Math.min(beadW, beadH);
  return {
    isBrick,
    cols: chart.cols,
    rows: chart.rows,
    beadW,
    beadH,
    originX,
    originY,
    clipX,
    clipY,
    numbers,
    gridLines: gridLines && smaller >= 4, // outlines on tiny beads would just look grey
    gap: smaller < 6 ? 0 : Math.max(1, smaller * 0.08), // small gap between beads
    radius: smaller * 0.35, // rounded corners
    rounded: smaller >= 5,
    ratio: 1, // set when drawing
    width: 0,
    height: 0,
  };
}

// ---------- Drawing helpers ----------

function fillFor(colorId) {
  if (colorId === null) return EMPTY_FILL;
  return getColor(colorId)?.hex ?? MISSING_FILL;
}

// Top-left corner of a bead's cell, measured from the chart's top-left corner.
// Brick stitch: odd rows (the 2nd, 4th…) are shifted right by half a bead.
function cellPosition(layout, row, col) {
  const shift = layout.isBrick && row % 2 === 1 ? layout.beadW / 2 : 0;
  return { x: col * layout.beadW + shift, y: row * layout.beadH };
}

function addBeadShape(path, layout, row, col) {
  const cell = cellPosition(layout, row, col);
  const { beadW, beadH, gap, radius, originX, originY } = layout;
  const x = originX + cell.x + gap / 2;
  const y = originY + cell.y + gap / 2;
  if (layout.rounded) path.roundRect(x, y, beadW - gap, beadH - gap, radius);
  else path.rect(x, y, beadW - gap, beadH - gap);
}

// Adds an × across a bead to a path (for missing colours).
function addMissingMark(path, layout, row, col) {
  const cell = cellPosition(layout, row, col);
  const x = layout.originX + cell.x;
  const y = layout.originY + cell.y;
  const inset = Math.min(layout.beadW, layout.beadH) * 0.25;
  path.moveTo(x + inset, y + inset);
  path.lineTo(x + layout.beadW - inset, y + layout.beadH - inset);
  path.moveTo(x + layout.beadW - inset, y + inset);
  path.lineTo(x + inset, y + layout.beadH - inset);
}

function strokeMissingMarks(ctx, path) {
  ctx.strokeStyle = MISSING_MARK;
  ctx.lineWidth = 1.5;
  ctx.stroke(path);
}

// Only draw in the chart area, not under the row/column numbers.
function clipToChartArea(ctx, layout) {
  ctx.beginPath();
  ctx.rect(layout.clipX, layout.clipY, layout.width - layout.clipX, layout.height - layout.clipY);
  ctx.clip();
}

// Which rows and columns can be seen on the canvas right now.
function visibleRange(layout) {
  const { beadW, beadH, originX, originY, clipX, clipY, width, height } = layout;
  return {
    firstRow: Math.max(0, Math.floor((clipY - originY) / beadH)),
    lastRow: Math.min(layout.rows - 1, Math.floor((height - originY) / beadH)),
    // one extra column on the left, for brick rows shifted by half a bead
    firstCol: Math.max(0, Math.floor((clipX - originX) / beadW) - 1),
    lastCol: Math.min(layout.cols - 1, Math.floor((width - originX) / beadW)),
  };
}

// ---------- Drawing the chart ----------

// Draws the visible part of the chart on a canvas of cssWidth × cssHeight.
export function drawChart(canvas, chart, layout, cssWidth, cssHeight) {
  // The canvas is never bigger than the screen, so it can always use the
  // screen's full sharpness (2–3 real pixels per CSS pixel on retina).
  const ratio = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(cssWidth * ratio);
  const pixelHeight = Math.round(cssHeight * ratio);
  // Changing the size wipes and rebuilds the canvas, so only do it when needed.
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  layout.ratio = ratio;
  layout.width = cssWidth;
  layout.height = cssHeight;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0); // from here on, draw in CSS pixels
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  ctx.save();
  clipToChartArea(ctx, layout);

  // Group the beads by colour into one shape per colour, then fill each
  // shape once. Much faster than filling thousands of beads one by one.
  const shapes = new Map(); // fill colour → Path2D
  const outlines = new Path2D();
  const missingMarks = new Path2D();
  const { firstRow, lastRow, firstCol, lastCol } = visibleRange(layout);
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      const colorId = chart.beads[row][col];
      const fill = fillFor(colorId);
      if (!shapes.has(fill)) shapes.set(fill, new Path2D());
      addBeadShape(shapes.get(fill), layout, row, col);
      if (layout.gridLines) addBeadShape(outlines, layout, row, col);
      if (isMissingColor(colorId)) addMissingMark(missingMarks, layout, row, col);
    }
  }
  for (const [fill, shape] of shapes) {
    ctx.fillStyle = fill;
    ctx.fill(shape);
  }
  if (layout.gridLines) {
    ctx.strokeStyle = BEAD_EDGE;
    ctx.lineWidth = 1;
    ctx.stroke(outlines);
  }
  strokeMissingMarks(ctx, missingMarks);
  ctx.restore();

  if (layout.numbers) drawNumbers(ctx, layout);
}

// Row numbers down the left, column numbers along the top. They stay at the
// edges while you scroll, so you can always see where you are.
function drawNumbers(ctx, layout) {
  const styles = getComputedStyle(document.documentElement);
  const background = styles.getPropertyValue('--bg').trim() || '#ffffff';
  const textColor = styles.getPropertyValue('--muted').trim() || '#666666';
  const { clipX: left, clipY: top, width, height, beadW, beadH, originX, originY } = layout;
  const { firstRow, lastRow, firstCol, lastCol } = visibleRange(layout);

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, top);
  ctx.fillRect(0, 0, left, height);

  // Small beads: only label every 5th or 10th so the numbers don't overlap.
  const colEvery = beadW >= 22 ? 1 : beadW >= 8 ? 5 : 10;
  const rowEvery = beadH >= 13 ? 1 : beadH >= 5 ? 5 : 10;
  const shows = (n, every) => n === 1 || n % every === 0;

  ctx.fillStyle = textColor;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, 0, width - left, top);
  ctx.clip();
  ctx.textAlign = 'center';
  for (let col = firstCol; col <= lastCol; col++) {
    // Columns line up with the unshifted rows (row 1, 3, 5… in brick stitch).
    if (shows(col + 1, colEvery)) ctx.fillText(col + 1, originX + col * beadW + beadW / 2, top / 2);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, left, height - top);
  ctx.clip();
  ctx.textAlign = 'right';
  for (let row = firstRow; row <= lastRow; row++) {
    if (shows(row + 1, rowEvery)) ctx.fillText(row + 1, left - 6, originY + row * beadH + beadH / 2);
  }
  ctx.restore();
}

// Redraws just one bead (used while painting, so dragging stays fast).
export function drawBead(canvas, layout, row, col, colorId) {
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(layout.ratio, 0, 0, layout.ratio, 0, 0);
  clipToChartArea(ctx, layout);
  const cell = cellPosition(layout, row, col);
  ctx.clearRect(layout.originX + cell.x, layout.originY + cell.y, layout.beadW, layout.beadH);

  const shape = new Path2D();
  addBeadShape(shape, layout, row, col);
  ctx.fillStyle = fillFor(colorId);
  ctx.fill(shape);
  if (layout.gridLines) {
    ctx.strokeStyle = BEAD_EDGE;
    ctx.lineWidth = 1;
    ctx.stroke(shape);
  }
  if (isMissingColor(colorId)) {
    const mark = new Path2D();
    addMissingMark(mark, layout, row, col);
    strokeMissingMarks(ctx, mark);
  }
  ctx.restore();
}

// Which bead is at (x, y), in CSS pixels from the canvas's top left?
// Returns { row, col }, or null if the point isn't on a bead
// (e.g. on the numbers, or the empty half-bead at the end of a brick row).
export function beadAtPoint(layout, x, y) {
  if (x < layout.clipX || y < layout.clipY) return null;
  const chartX = x - layout.originX;
  const chartY = y - layout.originY;
  const row = Math.floor(chartY / layout.beadH);
  if (row < 0 || row >= layout.rows) return null;
  // Undo the brick shift for this row before working out the column.
  const shift = layout.isBrick && row % 2 === 1 ? layout.beadW / 2 : 0;
  const col = Math.floor((chartX - shift) / layout.beadW);
  if (col < 0 || col >= layout.cols) return null;
  return { row, col };
}

// ---------- Small previews ----------

// A small picture of a chart (My charts list, photo preview): plain
// rectangles, no gaps, fitted inside maxWidth × maxHeight CSS pixels.
// fillOf(bead) is optional: it lets the photo preview draw beads that are
// plain colours instead of colour ids (return null for an empty bead).
export function drawPreview(canvas, chart, maxWidth, maxHeight, fillOf = null) {
  const size = chartSizeMm(chart);
  const scale = Math.min(maxWidth / size.widthMm, maxHeight / size.heightMm);

  const cssWidth = size.widthMm * scale;
  const cssHeight = size.heightMm * scale;
  const ratio = window.devicePixelRatio || 1;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.round(cssWidth * ratio);
  canvas.height = Math.round(cssHeight * ratio);

  const layout = { isBrick: size.isBrick, beadW: size.columnWidth * scale, beadH: size.rowHeight * scale };
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const shapes = new Map();
  chart.beads.forEach((beadRow, row) => {
    beadRow.forEach((colorId, col) => {
      let fill;
      if (fillOf) fill = fillOf(colorId) ?? EMPTY_FILL;
      // Missing colours show as solid red here: the preview is too small for an ×.
      else fill = isMissingColor(colorId) ? MISSING_MARK : fillFor(colorId);
      if (!shapes.has(fill)) shapes.set(fill, new Path2D());
      const { x, y } = cellPosition(layout, row, col);
      shapes.get(fill).rect(x, y, layout.beadW, layout.beadH);
    });
  });
  for (const [fill, shape] of shapes) {
    ctx.fillStyle = fill;
    ctx.fill(shape);
  }
}
