// Turns part of a photo into one colour per bead, and adjusts those colours.

import { beadSpacing } from './sizing.js';
import { rgbToLab } from './color-math.js';

// Largest photo side we keep. Big phone photos are shrunk to this once,
// when they're loaded, so cropping and previewing stay quick.
const MAX_PHOTO_SIDE = 2400;

// Two pixels closer than this (in Lab) count as "the same colour" when
// looking for a bead's most common colour.
const SAME_COLOR = 10;

// The chart's real shape, as drawn (brick includes the half-bead overhang).
export function chartShape(chart) {
  const { columnWidth, rowHeight } = beadSpacing(chart.stitch, chart.beadSize);
  const across = chart.cols + (chart.stitch === 'brick' ? 0.5 : 0); // beads across, incl. overhang
  const widthMm = across * columnWidth;
  const heightMm = chart.rows * rowHeight;
  return { across, widthMm, heightMm, aspect: widthMm / heightMm };
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff'; // see-through parts of a PNG count as white
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

// Copy part of an image (x, y, w, h) into a new canvas of outW × outH.
// Shrinking a lot in one go skips pixels and looks speckled, so we halve
// the size step by step, which blends neighbouring pixels properly.
function resize(source, x, y, w, h, outW, outH) {
  while (w > outW * 2 || h > outH * 2) {
    const stepW = Math.max(outW, Math.round(w / 2));
    const stepH = Math.max(outH, Math.round(h / 2));
    const step = makeCanvas(stepW, stepH);
    step.ctx.drawImage(source, x, y, w, h, 0, 0, stepW, stepH);
    source = step.canvas;
    x = 0;
    y = 0;
    w = stepW;
    h = stepH;
  }
  const out = makeCanvas(outW, outH);
  out.ctx.drawImage(source, x, y, w, h, 0, 0, outW, outH);
  return out;
}

// Load once: returns a canvas with the photo, at most MAX_PHOTO_SIDE pixels.
export function preparePhoto(image) {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(w, h));
  return resize(image, 0, 0, w, h, Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))).canvas;
}

// The average colour of a small 5 × 5 spot of the photo (for picking the background).
export function pickColorAt(photo, x, y) {
  const ctx = photo.getContext('2d', { willReadFrequently: true });
  const left = Math.min(Math.max(Math.round(x) - 2, 0), photo.width - 5);
  const top = Math.min(Math.max(Math.round(y) - 2, 0), photo.height - 5);
  const data = ctx.getImageData(Math.max(left, 0), Math.max(top, 0), 5, 5).data;
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    sum[0] += data[i];
    sum[1] += data[i + 1];
    sum[2] += data[i + 2];
  }
  return sum.map((total) => Math.round(total / 25));
}

// photo = canvas from preparePhoto(); crop = { x, y, w, h } in its pixels.
// Returns chart.rows rows of chart.cols [r, g, b] colours: each bead's
// MOST COMMON colour, so a bead on an edge between two colours gets one of
// them, not a muddy mix.
export function sampleBeadColors(photo, crop, chart) {
  const { across } = chartShape(chart);
  const isBrick = chart.stitch === 'brick';

  // Shrink the crop so each bead covers exactly K × K pixels. K is even, so a
  // half-bead shift is a whole number of pixels and lines up exactly with the grid.
  // We skip `inset` pixels at each edge of the bead, so neighbours don't bleed in.
  // (Very big charts use fewer pixels per bead to stay quick.)
  const beadCount = across * chart.rows;
  const [K, inset] = beadCount <= 20000 ? [8, 1] : beadCount <= 100000 ? [6, 1] : [4, 0];
  const width = Math.round(across * K);
  const height = chart.rows * K;
  const { ctx } = resize(photo, crop.x, crop.y, crop.w, crop.h, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data; // r, g, b, a, r, g, b, a…

  // The Lab colour of every pixel, worked out once.
  const labs = new Float32Array(width * height * 3);
  for (let p = 0; p < width * height; p++) {
    const lab = rgbToLab([pixels[p * 4], pixels[p * 4 + 1], pixels[p * 4 + 2]]);
    labs[p * 3] = lab[0];
    labs[p * 3 + 1] = lab[1];
    labs[p * 3 + 2] = lab[2];
  }

  const inner = K - 2 * inset; // pixels across the part of the bead we look at
  const area = new Int32Array(inner * inner); // pixel numbers inside one bead
  const counts = new Int32Array(inner * inner); // look-alike counts, reused for every bead
  const result = [];
  for (let row = 0; row < chart.rows; row++) {
    const shift = isBrick && row % 2 === 1 ? K / 2 : 0; // same shift as the grid drawing
    const beadRow = [];
    for (let col = 0; col < chart.cols; col++) {
      const left = col * K + shift + inset;
      const top = row * K + inset;
      let n = 0;
      for (let y = top; y < top + inner; y++) {
        for (let x = left; x < left + inner; x++) area[n++] = y * width + x;
      }
      beadRow.push(mostCommonColor(area, counts, labs, pixels));
    }
    result.push(beadRow);
  }
  return result;
}

// For each pixel, count how many others in the bead look the same (closer
// than SAME_COLOR). The pixel with the most look-alikes is the bead's main
// colour; we return the average of it and its look-alikes.
function mostCommonColor(area, counts, labs, pixels) {
  const limit = SAME_COLOR * SAME_COLOR;
  const closeEnough = (p, q) => {
    const dL = labs[p * 3] - labs[q * 3];
    const dA = labs[p * 3 + 1] - labs[q * 3 + 1];
    const dB = labs[p * 3 + 2] - labs[q * 3 + 2];
    return dL * dL + dA * dA + dB * dB <= limit;
  };

  // Each pair of pixels is compared once, and counts for both of them.
  counts.fill(1); // every pixel looks like itself
  for (let i = 0; i < area.length; i++) {
    for (let j = i + 1; j < area.length; j++) {
      if (closeEnough(area[i], area[j])) {
        counts[i]++;
        counts[j]++;
      }
    }
  }
  let bestIndex = 0;
  for (let i = 1; i < area.length; i++) if (counts[i] > counts[bestIndex]) bestIndex = i;
  const best = area[bestIndex];
  const bestCount = counts[bestIndex];

  let r = 0;
  let g = 0;
  let b = 0;
  for (const q of area) {
    if (!closeEnough(best, q)) continue;
    r += pixels[q * 4];
    g += pixels[q * 4 + 1];
    b += pixels[q * 4 + 2];
  }
  return [Math.round(r / bestCount), Math.round(g / bestCount), Math.round(b / bestCount)];
}

// ---------- Adjusting colours ----------

const clamp255 = (value) => Math.min(255, Math.max(0, Math.round(value)));

// brightness, contrast, saturation: −100 to 100, where 0 = unchanged.
export function adjustColor([r, g, b], { brightness, contrast, saturation }) {
  const shift = brightness * 1.28; // −128 to +128
  const c = contrast * 2.55;
  const contrastFactor = (259 * (c + 255)) / (255 * (259 - c)); // the usual photo-editor formula
  const saturationFactor = 1 + saturation / 100; // 0 = grey, 2 = twice as colourful

  const rgb = [r, g, b].map((v) => contrastFactor * (v + shift - 128) + 128);
  const grey = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return rgb.map((v) => clamp255(grey + (v - grey) * saturationFactor));
}
