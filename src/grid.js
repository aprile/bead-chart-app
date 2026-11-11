// Draws the bead chart grid on a <canvas>.
// Bead proportions come from sizing.js (which reads the dimensions in beads.js).

import { beadSpacing } from './sizing.js';

// Size limits for one bead on screen, measured on its shorter side, in CSS pixels.
// MIN stops long charts (bracelets) shrinking to dots: the page scrolls instead.
// MAX stops tiny charts turning into giant beads.
const MIN_BEAD_PX = 14;
const MAX_BEAD_PX = 48;

// Browsers refuse to draw canvases that are too big (Safari is the strictest).
const MAX_CANVAS_SIDE = 16384;
const MAX_CANVAS_AREA = 16777216;

const BEAD_FILL = '#d6d4d9';
const BEAD_EDGE = '#b3b0b8';

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

// chart = { stitch, beadSize, cols, rows }
export function drawGrid(canvas, chart) {
  const { stitch, beadSize, cols, rows } = chart;
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

  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0); // from here on, draw in CSS pixels
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  // A small gap between beads, and rounded corners.
  const gap = Math.max(1, Math.min(beadW, beadH) * 0.08);
  const radius = Math.min(beadW, beadH) * 0.35;

  // Add every bead to one shape, then fill and outline it all at once (much faster).
  ctx.beginPath();
  for (let row = 0; row < rows; row++) {
    const shift = isBrick && row % 2 === 1 ? beadW / 2 : 0;
    for (let col = 0; col < cols; col++) {
      const x = col * beadW + shift + gap / 2;
      const y = row * beadH + gap / 2;
      ctx.roundRect(x, y, beadW - gap, beadH - gap, radius);
    }
  }
  ctx.fillStyle = BEAD_FILL;
  ctx.fill();
  ctx.strokeStyle = BEAD_EDGE;
  ctx.lineWidth = 1;
  ctx.stroke();
}
