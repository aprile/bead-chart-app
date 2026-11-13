// Draws the bead chart on a <canvas>, and works out which bead is at a point.
// Bead proportions come from sizing.js (which reads the dimensions in beads.js).
//
// The canvas only covers the VISIBLE part of the chart (chart-view.js handles
// scrolling and zoom). So it's never huge, and stays sharp at any zoom.
//
// Turned sideways: the chart can be shown turned a quarter turn clockwise, so
// row 1 is on the left and rows run left to right (column 1 is at the top).
// Everything here draws the chart upright in "chart space", and one transform
// turns that onto the screen (useChartSpace). Pointer positions are turned
// back the other way (screenToChart), so hit-testing works the same.
// Only the row/column numbers are placed on the screen directly, so their
// text stays upright.

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
// screenX/Y: where the top-left corner of the chart is on the canvas, as you
// see it (it moves as you scroll). rotated: shown turned sideways.
// clipX: beads are hidden left of this; clipBottom: hidden in this many pixels
// at the bottom (that's where the row and column numbers go).
export function makeLayout(chart, scale, { screenX, screenY, rotated, clipX, clipBottom, gridLines, numbers }) {
  const { columnWidth, rowHeight, stitch, widthMm, heightMm } = chartSizeMm(chart);
  const beadW = columnWidth * scale;
  const beadH = rowHeight * scale;
  const smaller = Math.min(beadW, beadH);
  return {
    stitch,
    cols: chart.cols,
    rows: chart.rows,
    beadW,
    beadH,
    rotated,
    screenX,
    screenY,
    chartW: widthMm * scale, // the upright chart's size
    chartH: heightMm * scale,
    // Where the chart's top-left corner is in chart space. Upright, chart
    // space is the screen; turned, the chart starts at 0,0 and gets turned.
    originX: rotated ? 0 : screenX,
    originY: rotated ? 0 : screenY,
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
// Drawn in chart space.
function drawGridLines(ctx, layout, { firstRow, lastRow, firstCol, lastCol }) {
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
    const x = snapX(layout, originX + col * beadW);
    lines.moveTo(x, top);
    lines.lineTo(x, bottom);
  }
  for (let row = firstRow; row <= lastRow + 1; row++) {
    // the line above row `row`; counted from the bottom, it's after `rows - row` rows
    if (!isTenth(rows - row)) continue;
    const y = snapY(layout, originY + row * beadH);
    lines.moveTo(left, y);
    lines.lineTo(right, y);
  }
  ctx.strokeStyle = layout.emptyFill && isDark(layout.emptyFill) ? GRID_LINE_10TH_ON_DARK : GRID_LINE_10TH;
  // A bit wider than the gap between beads, so the line shows on the beads' edges too.
  ctx.lineWidth = Math.max(1.5, layout.gap + 1.5);
  ctx.stroke(lines);
}

// Is a colour like "#1a1a1a" dark? (Its brightness, as the eye sees it, is under 40%.)
function isDark(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b < 0.4;
}

// ---------- Turning sideways ----------

// From chart space to the screen: a quarter turn clockwise, so the chart's
// bottom edge (row 1) ends up on the left and its left edge at the top.
//   screen x = screenX + chartH − chart y
//   screen y = screenY + chart x
function chartToScreen(layout, x, y) {
  if (!layout.rotated) return { x, y };
  return { x: layout.screenX + layout.chartH - y, y: layout.screenY + x };
}

// The other way: a point on the screen (e.g. the pointer) in chart space.
function screenToChart(layout, x, y) {
  if (!layout.rotated) return { x, y };
  return { x: y - layout.screenY, y: layout.screenX + layout.chartH - x };
}

// Set ctx up to draw in chart space (in CSS pixels). The 6 numbers are the
// turn written as a canvas transform: x' = a·x + c·y + e, y' = b·x + d·y + f.
function useChartSpace(ctx, layout) {
  const r = layout.ratio;
  if (layout.rotated) ctx.setTransform(0, r, -r, 0, r * (layout.screenX + layout.chartH), r * layout.screenY);
  else ctx.setTransform(r, 0, 0, r, 0, 0);
}

// Back to plain screen pixels (CSS pixels).
function useScreenSpace(ctx, layout) {
  ctx.setTransform(layout.ratio, 0, 0, layout.ratio, 0, 0);
}

// Round a chart-space x or y so it lands on a whole screen pixel (crisp lines).
function snapX(layout, x) {
  const r = layout.ratio;
  if (!layout.rotated) return Math.round(x * r) / r;
  return Math.round((layout.screenY + x) * r) / r - layout.screenY; // chart x is screen y
}
function snapY(layout, y) {
  const r = layout.ratio;
  if (!layout.rotated) return Math.round(y * r) / r;
  const edge = layout.screenX + layout.chartH; // chart y is (edge − screen x)
  return edge - Math.round((edge - y) * r) / r;
}

// Where the chart area ends at the bottom (the numbers are below it).
function chartBottom(layout) {
  return layout.height - layout.clipBottom;
}

// Only draw in the chart area, not on the row/column numbers.
// (In screen space: call it before useChartSpace.)
function clipToChartArea(ctx, layout) {
  useScreenSpace(ctx, layout);
  ctx.beginPath();
  ctx.rect(layout.clipX, 0, layout.width - layout.clipX, chartBottom(layout));
  ctx.clip();
}

// The part of chart space that's visible in the chart area: { left, right, top, bottom }.
function visibleChartRect(layout) {
  const a = screenToChart(layout, layout.clipX, 0);
  const b = screenToChart(layout, layout.width, chartBottom(layout));
  return {
    left: Math.min(a.x, b.x),
    right: Math.max(a.x, b.x),
    top: Math.min(a.y, b.y),
    bottom: Math.max(a.y, b.y),
  };
}

// Which rows and columns can be seen on the canvas right now.
function visibleRange(layout) {
  const { beadW, beadH, originX, originY } = layout;
  const seen = visibleChartRect(layout);
  return {
    // one extra row above and column on the left, for beads shifted by an offset
    firstRow: Math.max(0, Math.floor((seen.top - originY) / beadH) - 1),
    lastRow: Math.min(layout.rows - 1, Math.floor((seen.bottom - originY) / beadH)),
    firstCol: Math.max(0, Math.floor((seen.left - originX) / beadW) - 1),
    lastCol: Math.min(layout.cols - 1, Math.floor((seen.right - originX) / beadW)),
  };
}

// How far the pointer moved between two points on the canvas, counted in
// whole beads down the chart (rows) and across it (cols). It works the same
// when the chart is turned sideways, and isn't thrown off by beads that are
// shifted by half a bead (brick, peyote).
export function beadsMoved(layout, from, to) {
  const a = screenToChart(layout, from.x, from.y);
  const b = screenToChart(layout, to.x, to.y);
  return { rows: Math.round((b.y - a.y) / layout.beadH), cols: Math.round((b.x - a.x) / layout.beadW) };
}

// The bead in the top-left corner of what's on screen, as you see it
// (e.g. where a paste starts). Turned sideways, that's the left-most column
// and the bottom-most row on screen.
export function topLeftBead(layout) {
  const { beadW, beadH, originX, originY } = layout;
  const seen = visibleChartRect(layout);
  const col = Math.ceil((seen.left - originX) / beadW); // first whole column
  const row = layout.rotated
    ? Math.floor((seen.bottom - originY) / beadH) - 1 // last whole row
    : Math.ceil((seen.top - originY) / beadH); // first whole row
  return {
    row: Math.min(Math.max(row, 0), layout.rows - 1),
    col: Math.min(Math.max(col, 0), layout.cols - 1),
  };
}

// ---------- Drawing the chart ----------

// Draws the visible part of the chart on a canvas of cssWidth × cssHeight.
// ratio: real pixels per CSS pixel. On screen that's the screen's sharpness;
// the PNG export uses 1 so the picture has exactly the size asked for.
export function drawChart(canvas, chart, layout, cssWidth, cssHeight, { ratio = window.devicePixelRatio || 1 } = {}) {
  // The canvas is never bigger than the screen, so it can always use the
  // screen's full sharpness (2–3 real pixels per CSS pixel on retina).
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
  useChartSpace(ctx, layout);

  // Group the beads by colour into one shape per colour, then fill each
  // shape once. Much faster than filling thousands of beads one by one.
  const shapes = new Map(); // fill colour → Path2D
  const missingMarks = new Path2D();
  const { firstRow, lastRow, firstCol, lastCol } = visibleRange(layout);
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      const colorId = chart.beads[row][col];
      if (colorId === null && layout.emptyFill === null) continue; // empty beads left out (PNG export)
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

  useScreenSpace(ctx, layout);
  if (layout.numbers) drawNumbers(ctx, layout);
}

// Numbers start at the BOTTOM LEFT: row 1 is the bottom row, column 1 the
// left column. Upright, row numbers run down the left edge and column numbers
// along the bottom. Turned sideways, it's the other way round: row numbers
// along the bottom (row 1 on the left), column numbers down the left edge.
// They stay at the edges while you scroll, and are drawn in screen space so
// the text is always upright.
function drawNumbers(ctx, layout) {
  const styles = getComputedStyle(document.documentElement);
  // The colours around the chart, from layout.css (they follow dark mode).
  const background = styles.getPropertyValue('--chart-area-bg').trim() || '#f4f4f5';
  const textColor = styles.getPropertyValue('--chart-numbers').trim() || '#666666';
  const { clipX: left, width, height, beadW, beadH, originX, originY, rows } = layout;
  const bottom = chartBottom(layout); // top edge of the bottom number strip
  const { firstRow, lastRow, firstCol, lastCol } = visibleRange(layout);

  ctx.fillStyle = background;
  ctx.fillRect(0, bottom, width, height - bottom);
  ctx.fillRect(0, 0, left, height);

  // Where each number goes on the screen: the middle of its bead.
  // Column numbers line up with the bottom row (row 1), and row numbers with
  // the first column, since those may be shifted (brick, peyote).
  const bottomRow = rows - 1;
  const middle = (row, col) => {
    const cell = cellPosition(layout, row, col);
    return chartToScreen(layout, originX + cell.x + beadW / 2, originY + cell.y + beadH / 2);
  };
  const columns = [];
  for (let col = firstCol; col <= lastCol; col++) columns.push({ number: col + 1, at: middle(bottomRow, col) });
  const rowNumbers = [];
  for (let row = firstRow; row <= lastRow; row++) rowNumbers.push({ number: rows - row, at: middle(row, 0) });

  // Upright: columns along the bottom, rows down the side. Turned: swapped.
  // The spacing is how far apart the numbers are on screen.
  const along = layout.rotated ? { labels: rowNumbers, spacing: beadH } : { labels: columns, spacing: beadW };
  const down = layout.rotated ? { labels: columns, spacing: beadW } : { labels: rowNumbers, spacing: beadH };

  // Small beads: only label every 5th or 10th so the numbers don't overlap.
  // Numbers side by side need more room than numbers stacked.
  const alongEvery = along.spacing >= 22 ? 1 : along.spacing >= 8 ? 5 : 10;
  const downEvery = down.spacing >= 13 ? 1 : down.spacing >= 5 ? 5 : 10;
  const shows = (n, every) => n === 1 || n % every === 0;

  ctx.fillStyle = textColor;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, bottom, width - left, height - bottom);
  ctx.clip();
  ctx.textAlign = 'center';
  for (const { number, at } of along.labels) {
    if (shows(number, alongEvery)) ctx.fillText(number, at.x, (bottom + height) / 2);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, left, bottom);
  ctx.clip();
  ctx.textAlign = 'right';
  for (const { number, at } of down.labels) {
    if (shows(number, downEvery)) ctx.fillText(number, left - 6, at.y);
  }
  ctx.restore();
}

// Redraws just one bead (used while painting, so dragging stays fast).
export function drawBead(canvas, layout, row, col, colorId) {
  const ctx = canvas.getContext('2d');
  ctx.save();
  clipToChartArea(ctx, layout);
  useChartSpace(ctx, layout);
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
  const point = screenToChart(layout, x, y); // turned back, if the chart is sideways
  const chartX = point.x - layout.originX;
  const chartY = point.y - layout.originY;
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
// brick or peyote it's stepped. With tint: false, only the outline is drawn.
export function drawSelection(canvas, layout, rect, { tint = true } = {}) {
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
  useChartSpace(sctx, layout);
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
  clipToChartArea(ctx, layout);
  useChartSpace(ctx, layout);
  if (tint) {
    ctx.fillStyle = SELECTION_TINT;
    ctx.fill(cells);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); // the scratch canvas is already in real pixels
  ctx.drawImage(scratch, 0, 0);
  ctx.restore();
}

// Draws a pasted piece floating over the chart, with its top-left bead at
// (at.row, at.col). piece = { rows, cols, beads }. Empty beads in the piece
// are see-through, and beads that hang off the chart aren't drawn.
export function drawPiece(canvas, layout, piece, at) {
  const shapes = new Map(); // fill colour → Path2D
  piece.beads.forEach((beadRow, r) => {
    beadRow.forEach((colorId, c) => {
      const row = at.row + r;
      const col = at.col + c;
      if (colorId === null || row < 0 || row >= layout.rows || col < 0 || col >= layout.cols) return;
      const fill = fillFor(colorId, layout.emptyFill);
      if (!shapes.has(fill)) shapes.set(fill, new Path2D());
      addBeadShape(shapes.get(fill), layout, row, col);
    });
  });
  const ctx = canvas.getContext('2d');
  ctx.save();
  clipToChartArea(ctx, layout);
  useChartSpace(ctx, layout);
  for (const [fill, shape] of shapes) {
    ctx.fillStyle = fill;
    ctx.fill(shape);
  }
  ctx.restore();
}
