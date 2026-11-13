// Draws the bead chart on a <canvas>, and works out which bead is at a point.
// Bead proportions come from sizing.js (which reads the dimensions in beads.js).
//
// The canvas only covers the VISIBLE part of the chart (chart-view.js handles
// scrolling and zoom). So it's never huge, and stays sharp at any zoom.

import { beadSpacing } from './sizing.js';
import { getStitch } from './stitches/index.js';
import { getColor, isMissingColor } from './colors.js';

// The starting bead size, measured on the bead's shorter side, in CSS pixels.
// MIN stops long charts (bracelets) shrinking to dots: you scroll instead.
// MAX stops tiny charts turning into giant beads.
const MIN_BEAD_PX = 14;
const MAX_BEAD_PX = 48;

// Empty beads are light grey, unless the chart has a background bead:
// then they're drawn in that colour (they'll be stitched in it).
const EMPTY_FILL = '#d6d4d9';
// Grid lines (only for stitches without offsets): every 10th row and column.
// On a dark background bead they switch to a light grey so they stay visible.
const GRID_LINE_10TH = '#8a8592';
const GRID_LINE_10TH_ON_DARK = '#bcb8c4';
// A colour that no longer exists: white with a red cross, easy to spot.
const MISSING_FILL = '#ffffff';
const MISSING_MARK = '#d32f2f';

// ---------- Sizes ----------

// The chart's real size in mm, including any overhang from offset beads
// (e.g. brick stitch is half a bead wider). `stitch` is the stitch module.
export function chartSizeMm(chart) {
  const stitch = getStitch(chart.stitch);
  const { columnWidth, rowHeight } = beadSpacing(chart.stitch, chart.beadSize);
  return {
    stitch,
    columnWidth,
    rowHeight,
    smallerMm: Math.min(columnWidth, rowHeight),
    widthMm: (chart.cols + stitch.overhang.across) * columnWidth,
    heightMm: (chart.rows + stitch.overhang.down) * rowHeight,
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
// clipX: beads are hidden left of this; clipBottom: hidden in this many pixels
// at the bottom (that's where the row and column numbers go).
export function makeLayout(chart, scale, { originX, originY, clipX, clipBottom, gridLines, numbers }) {
  const { columnWidth, rowHeight, stitch } = chartSizeMm(chart);
  const beadW = columnWidth * scale;
  const beadH = rowHeight * scale;
  const smaller = Math.min(beadW, beadH);
  return {
    stitch,
    cols: chart.cols,
    rows: chart.rows,
    beadW,
    beadH,
    originX,
    originY,
    clipX,
    clipBottom,
    numbers,
    emptyFill: emptyFillOf(chart),
    gridLines: gridLines && stitch.gridLines, // lines between rows and columns, if the stitch has them
    gap: smaller < 6 ? 0 : Math.max(1, smaller * 0.08), // small gap between beads
    radius: smaller * 0.35, // rounded corners
    rounded: smaller >= 5,
    ratio: 1, // set when drawing
    width: 0,
    height: 0,
  };
}

// ---------- Drawing helpers ----------

// What colour empty beads are drawn in (see EMPTY_FILL).
function emptyFillOf(chart) {
  return (chart.backgroundBead && getColor(chart.backgroundBead)?.hex) || EMPTY_FILL;
}

function fillFor(colorId, emptyFill) {
  if (colorId === null) return emptyFill;
  return getColor(colorId)?.hex ?? MISSING_FILL;
}

// Top-left corner of a bead's cell, measured from the chart's top-left corner.
// The stitch module says how far the bead is shifted (e.g. brick rows).
function cellPosition(layout, row, col) {
  const offset = layout.stitch.cellOffset(row, col, layout); // layout has rows and cols
  return { x: (col + offset.x) * layout.beadW, y: (row + offset.y) * layout.beadH };
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

// Grid lines (only for stitches without offsets): just every 10th line,
// counted from the bottom left like the numbers. The small gaps between the
// beads already separate them, so lines between every bead looked too busy.
// Positions are rounded to whole screen pixels so the lines stay crisp.
function drawGridLines(ctx, layout, { firstRow, lastRow, firstCol, lastCol }) {
  const snap = (value) => Math.round(value * layout.ratio) / layout.ratio;
  const { beadW, beadH, originX, originY, rows } = layout;
  const top = originY + firstRow * beadH;
  const bottom = originY + (lastRow + 1) * beadH;
  const left = originX + firstCol * beadW;
  const right = originX + (lastCol + 1) * beadW;
  const isTenth = (n) => n > 0 && n % 10 === 0;

  const lines = new Path2D();
  for (let col = firstCol; col <= lastCol + 1; col++) {
    // the line on the left of column `col`, i.e. after `col` columns
    if (!isTenth(col)) continue;
    const x = snap(originX + col * beadW);
    lines.moveTo(x, top);
    lines.lineTo(x, bottom);
  }
  for (let row = firstRow; row <= lastRow + 1; row++) {
    // the line above row `row`; counted from the bottom, it's after `rows - row` rows
    if (!isTenth(rows - row)) continue;
    const y = snap(originY + row * beadH);
    lines.moveTo(left, y);
    lines.lineTo(right, y);
  }
  ctx.strokeStyle = isDark(layout.emptyFill) ? GRID_LINE_10TH_ON_DARK : GRID_LINE_10TH;
  // A bit wider than the gap between beads, so the line shows on the beads' edges too.
  ctx.lineWidth = Math.max(1.5, layout.gap + 1.5);
  ctx.stroke(lines);
}

// Is a colour like "#1a1a1a" dark? (Its brightness, as the eye sees it, is under 40%.)
function isDark(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b < 0.4;
}

// Where the chart area ends at the bottom (the numbers are below it).
function chartBottom(layout) {
  return layout.height - layout.clipBottom;
}

// Only draw in the chart area, not on the row/column numbers.
function clipToChartArea(ctx, layout) {
  ctx.beginPath();
  ctx.rect(layout.clipX, 0, layout.width - layout.clipX, chartBottom(layout));
  ctx.clip();
}

// Which rows and columns can be seen on the canvas right now.
function visibleRange(layout) {
  const { beadW, beadH, originX, originY, clipX, width } = layout;
  return {
    // one extra row above and column on the left, for beads shifted by an offset
    firstRow: Math.max(0, Math.floor(-originY / beadH) - 1),
    lastRow: Math.min(layout.rows - 1, Math.floor((chartBottom(layout) - originY) / beadH)),
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
  const missingMarks = new Path2D();
  const { firstRow, lastRow, firstCol, lastCol } = visibleRange(layout);
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      const colorId = chart.beads[row][col];
      const fill = fillFor(colorId, layout.emptyFill);
      if (!shapes.has(fill)) shapes.set(fill, new Path2D());
      addBeadShape(shapes.get(fill), layout, row, col);
      if (isMissingColor(colorId)) addMissingMark(missingMarks, layout, row, col);
    }
  }
  for (const [fill, shape] of shapes) {
    ctx.fillStyle = fill;
    ctx.fill(shape);
  }
  if (layout.gridLines) drawGridLines(ctx, layout, visibleRange(layout));
  strokeMissingMarks(ctx, missingMarks);
  ctx.restore();

  if (layout.numbers) drawNumbers(ctx, layout);
}

// Numbers start at the BOTTOM LEFT: row 1 is the bottom row, column 1 the
// left column. Row numbers run down the left edge, column numbers along the
// bottom. They stay at the edges while you scroll.
function drawNumbers(ctx, layout) {
  const styles = getComputedStyle(document.documentElement);
  // The colours around the chart, from layout.css (they follow dark mode).
  const background = styles.getPropertyValue('--chart-area-bg').trim() || '#f4f4f5';
  const textColor = styles.getPropertyValue('--chart-numbers').trim() || '#666666';
  const { clipX: left, width, height, beadW, beadH, originX, originY, rows } = layout;
  const bottom = chartBottom(layout); // top edge of the column-number strip
  const { firstRow, lastRow, firstCol, lastCol } = visibleRange(layout);

  ctx.fillStyle = background;
  ctx.fillRect(0, bottom, width, height - bottom);
  ctx.fillRect(0, 0, left, height);

  // Small beads: only label every 5th or 10th so the numbers don't overlap.
  const colEvery = beadW >= 22 ? 1 : beadW >= 8 ? 5 : 10;
  const rowEvery = beadH >= 13 ? 1 : beadH >= 5 ? 5 : 10;
  const shows = (n, every) => n === 1 || n % every === 0;

  ctx.fillStyle = textColor;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  // Column numbers line up with the bottom row (row 1), which may be
  // shifted (e.g. in brick stitch).
  const bottomRow = rows - 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, bottom, width - left, height - bottom);
  ctx.clip();
  ctx.textAlign = 'center';
  for (let col = firstCol; col <= lastCol; col++) {
    const x = originX + cellPosition(layout, bottomRow, col).x + beadW / 2;
    if (shows(col + 1, colEvery)) ctx.fillText(col + 1, x, (bottom + height) / 2);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, left, bottom);
  ctx.clip();
  ctx.textAlign = 'right';
  // Row numbers line up with the first column, which may be shifted
  // (e.g. in peyote).
  for (let row = firstRow; row <= lastRow; row++) {
    const number = rows - row; // counted from the bottom
    const y = originY + cellPosition(layout, row, 0).y + beadH / 2;
    if (shows(number, rowEvery)) ctx.fillText(number, left - 6, y);
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
  ctx.fillStyle = fillFor(colorId, layout.emptyFill);
  ctx.fill(shape);
  // Clearing the cell also wiped half of its grid lines: draw them again.
  if (layout.gridLines) drawGridLines(ctx, layout, { firstRow: row, lastRow: row, firstCol: col, lastCol: col });
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
  if (x < layout.clipX || y > chartBottom(layout)) return null;
  const { beadW, beadH } = layout;
  const chartX = x - layout.originX;
  const chartY = y - layout.originY;
  // Beads can be shifted by up to a bead, so check the cells around the
  // point on the plain grid and see which one (if any) the point is inside.
  const nearRow = Math.floor(chartY / beadH);
  const nearCol = Math.floor(chartX / beadW);
  for (let row = nearRow - 1; row <= nearRow + 1; row++) {
    if (row < 0 || row >= layout.rows) continue;
    for (let col = nearCol - 1; col <= nearCol + 1; col++) {
      if (col < 0 || col >= layout.cols) continue;
      const cell = cellPosition(layout, row, col);
      const inside = chartX >= cell.x && chartX < cell.x + beadW && chartY >= cell.y && chartY < cell.y + beadH;
      if (inside) return { row, col };
    }
  }
  return null;
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

  const layout = { stitch: size.stitch, rows: chart.rows, cols: chart.cols, beadW: size.columnWidth * scale, beadH: size.rowHeight * scale };
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const emptyFill = emptyFillOf(chart);
  const shapes = new Map();
  chart.beads.forEach((beadRow, row) => {
    beadRow.forEach((colorId, col) => {
      let fill;
      if (fillOf) fill = fillOf(colorId) ?? emptyFill;
      // Missing colours show as solid red here: the preview is too small for an ×.
      else fill = isMissingColor(colorId) ? MISSING_MARK : fillFor(colorId, emptyFill);
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

// ---------- Selection outline ----------

const SELECTION_TINT = 'rgba(37, 99, 235, 0.18)'; // see-through blue over the selected beads
const SELECTION_LINE = '#2563eb';
const SELECTION_HALO = '#ffffff'; // a white edge outside the blue, so it shows on dark beads

// Draws a selection (from selection.js) over the chart: a tint on the beads
// and an outline around the outside. The outline follows the beads, so on
// brick or peyote it's stepped.
export function drawSelection(canvas, layout, rect) {
  // One rectangle per selected bead's cell.
  const cells = new Path2D();
  for (let row = rect.top; row <= rect.bottom; row++) {
    for (let col = rect.left; col <= rect.right; col++) {
      const cell = cellPosition(layout, row, col);
      cells.rect(layout.originX + cell.x, layout.originY + cell.y, layout.beadW, layout.beadH);
    }
  }

  // The outline: stroke every cell with a wide line on a scratch canvas, then
  // rub out everything inside the cells. Only the outside edge is left.
  const scratch = document.createElement('canvas');
  scratch.width = canvas.width;
  scratch.height = canvas.height;
  const sctx = scratch.getContext('2d');
  sctx.setTransform(layout.ratio, 0, 0, layout.ratio, 0, 0);
  sctx.lineJoin = 'round';
  sctx.strokeStyle = SELECTION_HALO;
  sctx.lineWidth = 7;
  sctx.stroke(cells);
  sctx.strokeStyle = SELECTION_LINE;
  sctx.lineWidth = 4;
  sctx.stroke(cells);
  sctx.globalCompositeOperation = 'destination-out';
  sctx.fill(cells);

  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(layout.ratio, 0, 0, layout.ratio, 0, 0);
  clipToChartArea(ctx, layout);
  ctx.fillStyle = SELECTION_TINT;
  ctx.fill(cells);
  ctx.setTransform(1, 0, 0, 1, 0, 0); // the scratch canvas is already in real pixels
  ctx.drawImage(scratch, 0, 0);
  ctx.restore();
}
