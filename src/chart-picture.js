// The picture under a chart's beads: the part of the photo (or chart
// picture) inside the crop box when I clicked Apply in "Import photo". It's
// saved with the chart, so I can show it under see-through beads and follow it.
//
// Saved shape (one per chart, see storage.js): { image, across, down }
// image:        a JPEG as a data URL ("data:image/jpeg;base64,…")
// across, down: how many beads wide and tall the picture covers. It's drawn
//               from the chart's bottom-left corner (where the work starts),
//               so it stays put when rows or columns are added at the top or right.

import { loadChartPicture, saveChartPicture, deleteChartPicture } from './storage.js';

const MAX_SIDE = 1600; // pixels: plenty for tracing, and small enough to save
const QUALITY = 0.85; // JPEG quality

// chart id → { image (an <img>), ready, across, down }, or null when the chart has none.
const loaded = new Map();

// Save part of a canvas (crop = { x, y, w, h } in its pixels) as the chart's picture.
// Returns false if it couldn't be saved (storage full).
export function setChartPicture(chartId, source, crop, { across, down }) {
  const scale = Math.min(1, MAX_SIDE / Math.max(crop.w, crop.h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(crop.w * scale));
  canvas.height = Math.max(1, Math.round(crop.h * scale));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
  const saved = { image: canvas.toDataURL('image/jpeg', QUALITY), across, down };
  loaded.delete(chartId);
  if (!saveChartPicture(chartId, saved)) {
    deleteChartPicture(chartId); // don't leave an older picture that no longer matches
    return false;
  }
  return true;
}

// Copy a chart's picture to another chart (Duplicate).
export function copyChartPicture(fromId, toId) {
  const saved = loadChartPicture(fromId);
  return saved ? saveChartPicture(toId, saved) : true;
}

export function removeChartPicture(chartId) {
  deleteChartPicture(chartId);
  loaded.set(chartId, null);
}

export function hasChartPicture(chartId) {
  return getChartPicture(chartId) !== null;
}

// The chart's picture, ready to draw: { image, across, down }. Null if it has
// none, or the picture is still loading: then onReady() is called once it's ready.
export function getChartPicture(chartId, onReady = () => {}) {
  if (!loaded.has(chartId)) {
    const saved = loadChartPicture(chartId);
    if (!isValid(saved)) {
      loaded.set(chartId, null);
    } else {
      const entry = { image: new Image(), ready: false, across: saved.across, down: saved.down };
      loaded.set(chartId, entry);
      entry.image.onload = () => {
        entry.ready = true;
        onReady();
      };
      entry.image.src = saved.image;
    }
  }
  const entry = loaded.get(chartId);
  if (!entry) return null;
  return entry.ready ? entry : { ...entry, image: null };
}

function isValid(saved) {
  return (
    saved !== null &&
    typeof saved === 'object' &&
    typeof saved.image === 'string' &&
    saved.image.startsWith('data:image/') &&
    saved.across > 0 &&
    saved.down > 0
  );
}
