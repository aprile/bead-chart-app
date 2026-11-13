// Makes a picture (PNG) of the whole chart, with an optional colour key
// under it. Used by the "Export picture…" dialog (picture-dialog.js).
//
// It reuses the normal chart drawing (grid.js), just on a canvas the size of
// the whole chart, at exactly the bead size asked for.

import { makeLayout, drawChart, chartSizeMm } from './grid.js';
import { getColor, colorLabel } from './colors.js';

// Browsers can't make huge canvases (the limits differ; these are safe everywhere).
const MAX_SIDE = 16000; // pixels
const MAX_AREA = 120_000_000; // pixels in total

const PADDING = 24; // white space around everything (none when transparent)
const KEY_ROW = 28; // height of one colour in the key
const KEY_SWATCH = 18;
const KEY_COLUMN = 280; // width of one column of the key
const KEY_GAP = 20; // space between the chart and the key
const TEXT = '#1f1d23';
const TEXT_MUTED = '#6b6772';
const PAPER = '#ffffff';

// options = { beadPx, gridLines, key, transparent, sideways }
// beadPx: the bead's shorter side, in pixels.
// Returns { canvas, beadPx, shrunk } — beadPx may be smaller than asked if the
// picture would have been too big (then shrunk is true).
export function renderPicture(chart, options) {
  const size = chartSizeMm(chart);
  const keyRows = options.key ? keyEntries(chart, options) : [];

  // Work out the size, shrinking the beads if the picture would be too big.
  let beadPx = options.beadPx;
  let shrunk = false;
  let plan = measure(size, beadPx, keyRows, options);
  while ((plan.width > MAX_SIDE || plan.height > MAX_SIDE || plan.width * plan.height > MAX_AREA) && beadPx > 2) {
    beadPx = Math.max(2, Math.floor(beadPx * 0.8));
    shrunk = true;
    plan = measure(size, beadPx, keyRows, options);
  }

  // 1. The chart on its own canvas, using the normal drawing code.
  const chartCanvas = document.createElement('canvas');
  const layout = makeLayout(chart, plan.scale, {
    screenX: 0,
    screenY: 0,
    rotated: options.sideways,
    clipX: 0,
    clipBottom: 0,
    gridLines: options.gridLines,
    numbers: false,
  });
  if (options.transparent) layout.emptyFill = null; // leave empty beads out
  drawChart(chartCanvas, chart, layout, plan.chartWidth, plan.chartHeight, { ratio: 1 });

  // 2. The picture: paper (unless transparent), the chart, then the key.
  const canvas = document.createElement('canvas');
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext('2d');
  if (!options.transparent) {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, plan.width, plan.height);
  }
  ctx.drawImage(chartCanvas, plan.padding, plan.padding);
  if (keyRows.length > 0) drawKey(ctx, keyRows, plan);

  return { canvas, beadPx, shrunk };
}

// Sizes of everything for a bead size.
function measure(size, beadPx, keyRows, options) {
  const scale = beadPx / size.smallerMm; // pixels per mm
  const across = Math.round(size.widthMm * scale);
  const down = Math.round(size.heightMm * scale);
  const chartWidth = options.sideways ? down : across;
  const chartHeight = options.sideways ? across : down;
  const padding = options.transparent ? 0 : PADDING;

  let keyHeight = 0;
  let keyColumns = 1;
  let width = chartWidth;
  if (keyRows.length > 0) {
    // As many key columns as fit under the chart (at least one).
    width = Math.max(chartWidth, KEY_COLUMN);
    keyColumns = Math.max(1, Math.floor(width / KEY_COLUMN));
    keyHeight = KEY_GAP + KEY_ROW + Math.ceil(keyRows.length / keyColumns) * KEY_ROW;
  }
  return {
    scale,
    chartWidth,
    chartHeight,
    padding,
    keyColumns,
    keyTop: padding + chartHeight + KEY_GAP,
    width: width + 2 * padding,
    height: chartHeight + keyHeight + 2 * padding,
  };
}

// The colours in the chart with their bead counts, most-used first.
// Empty beads count as the background bead (if the chart has one and they're drawn).
function keyEntries(chart, options) {
  const counts = new Map();
  for (const row of chart.beads) {
    for (const id of row) {
      const counted = id ?? (options.transparent ? null : chart.backgroundBead);
      if (counted) counts.set(counted, (counts.get(counted) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([id, count]) => ({ color: getColor(id), count, background: id === chart.backgroundBead }))
    .filter((entry) => entry.color) // skip colours that no longer exist
    .sort((a, b) => b.count - a.count);
}

function drawKey(ctx, rows, plan) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  ctx.textBaseline = 'middle';
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillStyle = TEXT;
  ctx.fillText(`Colours (${total} beads)`, plan.padding, plan.keyTop + KEY_ROW / 2);

  rows.forEach((row, i) => {
    const perColumn = Math.ceil(rows.length / plan.keyColumns);
    const column = Math.floor(i / perColumn);
    const x = plan.padding + column * KEY_COLUMN;
    const y = plan.keyTop + KEY_ROW + (i % perColumn) * KEY_ROW;
    const middle = y + KEY_ROW / 2;

    // Swatch: a rounded square with a thin outline, so white beads show.
    ctx.beginPath();
    ctx.roundRect(x, middle - KEY_SWATCH / 2, KEY_SWATCH, KEY_SWATCH, 4);
    ctx.fillStyle = row.color.hex;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // "401 Opaque Black (background)" ... "312"
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = TEXT;
    const label = colorLabel(row.color) + (row.background ? ' (background)' : '');
    const countText = String(row.count);
    const countWidth = ctx.measureText(countText).width;
    const right = x + KEY_COLUMN - 16;
    ctx.fillText(fitText(ctx, label, right - countWidth - 12 - (x + KEY_SWATCH + 8)), x + KEY_SWATCH + 8, middle);
    ctx.fillStyle = TEXT_MUTED;
    ctx.textAlign = 'right';
    ctx.fillText(countText, right, middle);
    ctx.textAlign = 'left';
  });
}

// Shortens text with "…" so it fits in maxWidth pixels.
function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let shorter = text;
  while (shorter.length > 1 && ctx.measureText(`${shorter}…`).width > maxWidth) shorter = shorter.slice(0, -1);
  return `${shorter}…`;
}

// Makes the browser download the picture, e.g. "Spiral cuff.png".
export function downloadPicture(canvas, chartName) {
  const name = chartName.replace(/[\\/:*?"<>|]+/g, '').trim() || 'chart';
  canvas.toBlob((blob) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${name}.png`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, 'image/png');
}
