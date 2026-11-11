// Draws the bead chart grid on a <canvas>, and works out which bead is at a point.
// Bead proportions come from sizing.js (which reads the dimensions in beads.js).

import { beadSpacing } from './sizing.js';
import { getColor, isMissingColor } from './colors.js';

// Size limits for one bead on screen, measured on its shorter side, in CSS pixels.
// MIN stops long charts (bracelets) shrinking to dots: the page scrolls instead.
// MAX stops tiny charts turning into giant beads.
const MIN_BEAD_PX = 14;
const MAX_BEAD_PX = 48;

// Browsers refuse to draw canvases that are too big (Safari is the strictest).
const MAX_CANVAS_SIDE = 16384;
const MAX_CANVAS_AREA = 16777216;

const EMPTY_FILL = '#d6d4d9';
const BEAD_EDGE = '#b3b0b8';
// A colour that no longer exists: white with a red cross, easy to spot.
const MISSING_FILL = '#ffffff';
const MISSING_MARK = '#d32f2f';

// Pick how many screen pixels one millimetre gets.
function chooseScale(widthMm, heightMm, smallerBeadMm, availWidth, availHeight) {
  const fit = Math.min(availWidth / widthMm, availHeight / heightMm);
  const min = MIN_BEAD_PX / smallerBeadMm;
  const max = MAX_BEAD_PX / smallerBeadMm;
  return Math.min(Math.max(fit, min), max);
}

// Retina screens have 2–3 real pixels per CSS pixel. We draw at that
// density so the beads stay sharp, unless the canvas would get too big.
function choosePixelRatio(cssWidth, cssHeight) {
  let ratio = window.devicePixelRatio || 1;
  ratio = Math.min(ratio, MAX_CANVAS_SIDE / cssWidth, MAX_CANVAS_SIDE / cssHeight);
  ratio = Math.min(ratio, Math.sqrt(MAX_CANVAS_AREA / (cssWidth * cssHeight)));
  return ratio;
}

function fillFor(colorId) {
  if (colorId === null) return EMPTY_FILL;
  return getColor(colorId)?.hex ?? MISSING_FILL;
}

// Adds an × across a bead to a path (for missing colours).
function addMissingMark(path, layout, row, col) {
  const { x, y } = cellPosition(layout, row, col);
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

// Top-left corner of a bead's cell, in CSS pixels.
// Brick stitch: odd rows (the 2nd, 4th…) are shifted right by half a bead.
function cellPosition(layout, row, col) {
  const shift = layout.isBrick && row % 2 === 1 ? layout.beadW / 2 : 0;
  return { x: col * layout.beadW + shift, y: row * layout.beadH };
}

function addBeadShape(path, layout, row, col) {
  const { x, y } = cellPosition(layout, row, col);
  const { beadW, beadH, gap, radius } = layout;
  path.roundRect(x + gap / 2, y + gap / 2, beadW - gap, beadH - gap, radius);
}

// Draws the whole chart. Returns the "layout" (sizes in pixels), which
// beadAtPoint() and drawBead() need.
export function drawGrid(canvas, chart) {
  const { stitch, beadSize, cols, rows, beads } = chart;
  const { columnWidth, rowHeight } = beadSpacing(stitch, beadSize);
  const isBrick = stitch === 'brick';

  // Brick stitch: the shifted rows make the chart half a bead wider.
  const widthMm = (cols + (isBrick ? 0.5 : 0)) * columnWidth;
  const heightMm = rows * rowHeight;

  // Space available: the width of the box around the canvas, and most of the window height.
  const availWidth = canvas.parentElement.clientWidth;
  const availHeight = window.innerHeight - 48;
  const scale = chooseScale(widthMm, heightMm, Math.min(columnWidth, rowHeight), availWidth, availHeight);

  const beadW = columnWidth * scale; // one bead, in CSS pixels
  const beadH = rowHeight * scale;
  const cssWidth = widthMm * scale;
  const cssHeight = heightMm * scale;

  // The canvas has two sizes: how big it looks (style) and how many
  // pixels it really has (width/height). Retina needs more real pixels.
  const ratio = choosePixelRatio(cssWidth, cssHeight);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.round(cssWidth * ratio);
  canvas.height = Math.round(cssHeight * ratio);

  const layout = {
    isBrick,
    cols,
    rows,
    beadW,
    beadH,
    ratio,
    gap: Math.max(1, Math.min(beadW, beadH) * 0.08), // small gap between beads
    radius: Math.min(beadW, beadH) * 0.35, // rounded corners
  };

  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0); // from here on, draw in CSS pixels
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  // Group the beads by colour into one shape per colour, then fill each
  // shape once. Much faster than filling thousands of beads one by one.
  const shapes = new Map(); // fill colour → Path2D
  const outlines = new Path2D();
  const missingMarks = new Path2D();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const colorId = beads[row][col];
      const fill = fillFor(colorId);
      if (!shapes.has(fill)) shapes.set(fill, new Path2D());
      addBeadShape(shapes.get(fill), layout, row, col);
      addBeadShape(outlines, layout, row, col);
      if (isMissingColor(colorId)) addMissingMark(missingMarks, layout, row, col);
    }
  }
  for (const [fill, shape] of shapes) {
    ctx.fillStyle = fill;
    ctx.fill(shape);
  }
  ctx.strokeStyle = BEAD_EDGE;
  ctx.lineWidth = 1;
  ctx.stroke(outlines);
  strokeMissingMarks(ctx, missingMarks);

  return layout;
}

// A small picture of a chart (My charts list, photo preview): plain
// rectangles, no gaps, fitted inside maxWidth × maxHeight CSS pixels.
// fillOf(bead) is optional: it lets the photo preview draw beads that are
// plain colours instead of colour ids (return null for an empty bead).
export function drawPreview(canvas, chart, maxWidth, maxHeight, fillOf = null) {
  const { columnWidth, rowHeight } = beadSpacing(chart.stitch, chart.beadSize);
  const isBrick = chart.stitch === 'brick';
  const widthMm = (chart.cols + (isBrick ? 0.5 : 0)) * columnWidth;
  const heightMm = chart.rows * rowHeight;
  const scale = Math.min(maxWidth / widthMm, maxHeight / heightMm);

  const cssWidth = widthMm * scale;
  const cssHeight = heightMm * scale;
  const ratio = window.devicePixelRatio || 1;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.round(cssWidth * ratio);
  canvas.height = Math.round(cssHeight * ratio);

  const layout = { isBrick, beadW: columnWidth * scale, beadH: rowHeight * scale };
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

// Redraws just one bead (used while painting, so dragging stays fast).
export function drawBead(canvas, layout, row, col, colorId) {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(layout.ratio, 0, 0, layout.ratio, 0, 0);
  const { x, y } = cellPosition(layout, row, col);
  ctx.clearRect(x, y, layout.beadW, layout.beadH);

  const shape = new Path2D();
  addBeadShape(shape, layout, row, col);
  ctx.fillStyle = fillFor(colorId);
  ctx.fill(shape);
  ctx.strokeStyle = BEAD_EDGE;
  ctx.lineWidth = 1;
  ctx.stroke(shape);
  if (isMissingColor(colorId)) {
    const mark = new Path2D();
    addMissingMark(mark, layout, row, col);
    strokeMissingMarks(ctx, mark);
  }
}

// Which bead is at (x, y), in CSS pixels from the canvas's top left?
// Returns { row, col }, or null if the point isn't on a bead
// (e.g. the empty half-bead at the end of a brick row).
export function beadAtPoint(layout, x, y) {
  const row = Math.floor(y / layout.beadH);
  if (row < 0 || row >= layout.rows) return null;
  // Undo the brick shift for this row before working out the column.
  const shift = layout.isBrick && row % 2 === 1 ? layout.beadW / 2 : 0;
  const col = Math.floor((x - shift) / layout.beadW);
  if (col < 0 || col >= layout.cols) return null;
  return { row, col };
}
