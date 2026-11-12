// Calibration: my own measurements of finished beadwork, which replace the
// spec bead sizes (in beads.js) for one bead size + stitch.
//
// Saved shape (from PLAN.md), one entry per bead size + stitch I've measured:
// [{ beadSize, stitch, mmPerColumn, mmPerRow, measured }]
// - mmPerColumn / mmPerRow: null means "use the spec value" for that direction.
// - measured: what I typed, e.g. { columns: { beads: 20, mm: 41 }, rows: null },
//   so the form can show it again.

import { load, save, STORAGE_KEYS, isValidCalibrationList } from './storage.js';

// A measured bead must be between these sizes, to catch typing mistakes.
export const MIN_MM_PER_BEAD = 0.5;
export const MAX_MM_PER_BEAD = 5;

function loadCalibrations() {
  const saved = load(STORAGE_KEYS.calibration);
  return isValidCalibrationList(saved) ? saved : [];
}

let entries = loadCalibrations();

function sameCombination(entry, stitch, beadSize) {
  return entry.stitch === stitch && entry.beadSize === beadSize;
}

export function getCalibration(stitch, beadSize) {
  return entries.find((entry) => sameCombination(entry, stitch, beadSize)) ?? null;
}

// columns / rows: { beads, mm } that I measured, or null to use the spec.
export function saveCalibration(stitch, beadSize, { columns, rows }) {
  entries = entries.filter((entry) => !sameCombination(entry, stitch, beadSize));
  if (columns || rows) {
    entries.push({
      beadSize,
      stitch,
      mmPerColumn: columns ? columns.mm / columns.beads : null,
      mmPerRow: rows ? rows.mm / rows.beads : null,
      measured: { columns, rows },
    });
  }
  save(STORAGE_KEYS.calibration, entries);
}

export function resetCalibration(stitch, beadSize) {
  saveCalibration(stitch, beadSize, { columns: null, rows: null });
}
