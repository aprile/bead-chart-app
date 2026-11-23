// Colours, my custom colours, my screen-colour edits, and the stash.
// The Miyuki list (miyuki-colors.json) is only read, never changed.
// Everything I change is saved separately in localStorage.

import data from './data/miyuki-colors.json';
import { BEAD_SIZES } from './beads.js';
import { load, save, STORAGE_KEYS } from './storage.js';

export const BEAD_SIZE_NAMES = Object.keys(BEAD_SIZES); // ['11/0', '15/0']
const MIYUKI_COLORS = data.colors;

// ---- Screen-colour overrides for Miyuki colours ----
// Saved shape: { "miyuki-401": "#101010", ... }

const overrides = load(STORAGE_KEYS.overrides) ?? {};

// ---- Colour family changes for Miyuki colours ----
// Saved shape: { "miyuki-401": "black", ... } (only the ones I changed)

const familyOverrides = load(STORAGE_KEYS.familyOverrides) ?? {};

// ---- Custom colours ----
// Saved shape: { nextNumber: 3, colors: [{ id: "custom-1", name, hex, sizes, code?, notes?, family?, custom: true }] }
// family: optional; without one, a custom colour goes under "My colours".
// nextNumber only ever goes up, so a deleted colour's id is never reused.

const custom = loadCustomColors();

function loadCustomColors() {
  const saved = load(STORAGE_KEYS.customColors);
  const colors = Array.isArray(saved?.colors) ? saved.colors : [];
  const highest = Math.max(0, ...colors.map((color) => parseInt(color.id.replace('custom-', ''), 10) || 0));
  return { nextNumber: Math.max(saved?.nextNumber || 1, highest + 1), colors };
}

// ---- Looking colours up ----
// One Map from id → colour (with my screen-colour and family edits applied).
// edited: I changed its screen colour. familyEdited: I changed its family.
// Rebuilt whenever something changes, so lookups while drawing stay quick.

const colorsById = new Map();

function rebuildLookup() {
  colorsById.clear();
  for (const color of MIYUKI_COLORS) {
    let mine = color;
    const hex = overrides[color.id];
    if (hex) mine = { ...mine, hex, edited: true };
    const family = familyOverrides[color.id];
    if (family) mine = { ...mine, family, familyEdited: true };
    colorsById.set(color.id, mine);
  }
  for (const color of custom.colors) colorsById.set(color.id, color);
}
rebuildLookup();

export function getColor(id) {
  return colorsById.get(id);
}

// A bead whose colour no longer exists (e.g. a deleted custom colour in an
// imported chart). Empty beads (null) are not "missing".
export function isMissingColor(id) {
  return id !== null && !colorsById.has(id);
}

export function countMissingBeads(beads) {
  return beads.flat().filter(isMissingColor).length;
}

// Custom colours first, then the Miyuki list.
export function allColors() {
  return [...custom.colors, ...MIYUKI_COLORS.map((color) => colorsById.get(color.id))];
}

// "401 Opaque Black", or just the name if a custom colour has no code.
export function colorLabel(color) {
  return [color.code, color.name].filter(Boolean).join(' ');
}

// The original estimated colour from the JSON file.
export function estimatedHex(id) {
  return MIYUKI_COLORS.find((color) => color.id === id)?.hex;
}

// My screen-colour edit for a Miyuki colour, or undefined if I haven't edited it.
export function getColorOverride(id) {
  return overrides[id];
}

export function setColorOverride(id, hex) {
  overrides[id] = hex;
  save(STORAGE_KEYS.overrides, overrides);
  rebuildLookup();
}

export function resetColorOverride(id) {
  delete overrides[id];
  save(STORAGE_KEYS.overrides, overrides);
  rebuildLookup();
}

// The family a Miyuki colour has in the Miyuki list (before my change).
export function originalFamily(id) {
  return MIYUKI_COLORS.find((color) => color.id === id)?.family;
}

// Change a Miyuki colour's family. Choosing its original family again
// removes my change.
export function setFamilyOverride(id, family) {
  if (!family || family === originalFamily(id)) delete familyOverrides[id];
  else familyOverrides[id] = family;
  save(STORAGE_KEYS.familyOverrides, familyOverrides);
  rebuildLookup();
}

// ---- Adding, editing and deleting custom colours ----

// Tidy up what the form gave us into the shape from PLAN.md.
function cleanCustomColor(id, { name, hex, sizes, code, notes, family }) {
  const color = {
    id,
    name: name.trim(),
    hex,
    sizes: BEAD_SIZE_NAMES.filter((size) => sizes.includes(size)), // always in 11/0, 15/0 order
    custom: true,
  };
  if (code?.trim()) color.code = code.trim();
  if (notes?.trim()) color.notes = notes.trim();
  if (family) color.family = family;
  return color;
}

function saveCustomColors() {
  save(STORAGE_KEYS.customColors, custom);
  rebuildLookup();
}

export function addCustomColor(fields) {
  const color = cleanCustomColor(`custom-${custom.nextNumber}`, fields);
  custom.nextNumber++;
  custom.colors.push(color);
  saveCustomColors();
  // New custom colours go straight into my stash.
  for (const size of color.sizes) stash[size].add(color.id);
  saveStash();
  return color;
}

// One of my custom colours with this name (ignoring capitals and spaces at
// the ends) and this screen colour, or undefined. Used when importing a chart.
export function findCustomColor(name, hex) {
  const wanted = name.trim().toLowerCase();
  return custom.colors.find((color) => color.name.trim().toLowerCase() === wanted && color.hex.toLowerCase() === hex.toLowerCase());
}

export function updateCustomColor(id, fields) {
  const index = custom.colors.findIndex((color) => color.id === id);
  const old = custom.colors[index];
  const updated = cleanCustomColor(id, fields);
  custom.colors[index] = updated;
  saveCustomColors();
  // A size I removed leaves the stash; a size I added joins it.
  for (const size of BEAD_SIZE_NAMES) {
    if (!updated.sizes.includes(size)) stash[size].delete(id);
    else if (!old.sizes.includes(size)) stash[size].add(id);
  }
  saveStash();
}

export function deleteCustomColor(id) {
  custom.colors = custom.colors.filter((color) => color.id !== id);
  saveCustomColors();
  for (const size of BEAD_SIZE_NAMES) stash[size].delete(id);
  saveStash();
}

// ---- Families and finishes (for filters and sorting) ----

// Roughly light → rainbow → dark. Any family not listed here goes at the end.
const FAMILY_ORDER = [
  'white', 'clear', 'beige', 'yellow', 'gold', 'orange', 'copper', 'bronze',
  'red', 'pink', 'purple', 'blue', 'turquoise', 'green', 'brown', 'gray',
  'silver', 'black', 'other',
];

const familiesInData = new Set(MIYUKI_COLORS.map((color) => color.family));
export const FAMILIES = [
  ...FAMILY_ORDER.filter((family) => familiesInData.has(family)),
  ...[...familiesInData].filter((family) => !FAMILY_ORDER.includes(family)).sort(),
];

// The family names A–Z, for choosing one (filters, edit forms).
export const FAMILY_NAMES = [...FAMILIES].sort((a, b) => a.localeCompare(b));

export const FINISHES = [...new Set(MIYUKI_COLORS.flatMap((color) => color.finish))].sort();

// Codes sort by their number first, so 2 comes before 10, and 1 before 1F.
function compareCodes(a, b) {
  return parseInt(a.code, 10) - parseInt(b.code, 10) || a.code.localeCompare(b.code);
}

// Custom colours without a family go after all the families.
function familyRank(color) {
  const rank = color.family ? FAMILIES.indexOf(color.family) : -1;
  return rank === -1 ? FAMILIES.length : rank;
}

// By family; inside a family, Miyuki colours by code, then my custom colours by name.
export function sortByFamily(colors) {
  return [...colors].sort((a, b) => {
    const byFamily = familyRank(a) - familyRank(b);
    if (byFamily !== 0) return byFamily;
    if (a.custom !== b.custom) return a.custom ? 1 : -1;
    if (a.custom) return a.name.localeCompare(b.name);
    return compareCodes(a, b);
  });
}

// By colour code, as a number (1, 2, 4, 10, 401, 4201…). My custom colours
// are mixed in by their code too. In order:
// 1. colours with no code (my custom colours without one), by name;
// 2. codes starting with a number, by that number (2 before 10, 1 before 1F);
// 3. codes starting with letters (e.g. another brand's "DB-010"), A–Z.
// With the same code, the Miyuki colour comes before mine.
function codeGroup(color) {
  if (!color.code) return 0;
  return Number.isNaN(parseInt(color.code, 10)) ? 2 : 1;
}

export function sortByCode(colors) {
  return [...colors].sort((a, b) => {
    const group = codeGroup(a) - codeGroup(b);
    if (group !== 0) return group;
    if (codeGroup(a) === 0) return a.name.localeCompare(b.name);
    const byCode =
      codeGroup(a) === 1
        ? compareCodes(a, b)
        : a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
    if (byCode !== 0) return byCode;
    if (a.custom !== b.custom) return a.custom ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

// ---- The stash ----
// Saved shape (from PLAN.md): { "11/0": [ids...], "15/0": [ids...] }
// In memory we use a Set per size: quick to check "is this id in it?".

const stash = loadStash();

function loadStash() {
  const result = Object.fromEntries(BEAD_SIZE_NAMES.map((size) => [size, new Set()]));
  const saved = load(STORAGE_KEYS.stash);
  for (const size of BEAD_SIZE_NAMES) {
    if (Array.isArray(saved?.[size])) saved[size].forEach((id) => result[size].add(id));
  }
  return result;
}

function saveStash() {
  save(STORAGE_KEYS.stash, Object.fromEntries(BEAD_SIZE_NAMES.map((size) => [size, [...stash[size]]])));
}

export function isInStash(id, size) {
  return stash[size].has(id);
}

export function setInStash(id, size, inStash) {
  if (inStash) stash[size].add(id);
  else stash[size].delete(id);
  saveStash(); // straight away, so a refresh never loses a tick
}

export function stashCount(size) {
  // Only count ids that still exist (not deleted custom colours).
  return [...stash[size]].filter((id) => colorsById.has(id)).length;
}

// The stash colours for one bead size, sorted by colour family.
export function stashColors(size) {
  const colors = [...stash[size]].map(getColor).filter(Boolean); // skip unknown ids
  return sortByFamily(colors);
}
