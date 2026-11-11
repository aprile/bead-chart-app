// Colours and the stash.
// The Miyuki list (miyuki-colors.json) is only read, never changed.
// The stash is saved separately in localStorage.

import data from './data/miyuki-colors.json';
import { BEAD_SIZES } from './beads.js';

export const BEAD_SIZE_NAMES = Object.keys(BEAD_SIZES); // ['11/0', '15/0']
export const ALL_COLORS = data.colors;

const colorsById = new Map(ALL_COLORS.map((color) => [color.id, color]));

export function getColor(id) {
  return colorsById.get(id);
}

// ---- Families and finishes (for filters and sorting) ----

// Roughly light → rainbow → dark. Any family not listed here goes at the end.
const FAMILY_ORDER = [
  'white', 'clear', 'beige', 'yellow', 'gold', 'orange', 'copper', 'bronze',
  'red', 'pink', 'purple', 'blue', 'turquoise', 'green', 'brown', 'gray',
  'silver', 'black', 'other',
];

const familiesInData = new Set(ALL_COLORS.map((color) => color.family));
export const FAMILIES = [
  ...FAMILY_ORDER.filter((family) => familiesInData.has(family)),
  ...[...familiesInData].filter((family) => !FAMILY_ORDER.includes(family)).sort(),
];

export const FINISHES = [...new Set(ALL_COLORS.flatMap((color) => color.finish))].sort();

// Codes sort by their number first, so 2 comes before 10, and 1 before 1F.
function compareCodes(a, b) {
  return parseInt(a.code, 10) - parseInt(b.code, 10) || a.code.localeCompare(b.code);
}

export function sortByFamily(colors) {
  return [...colors].sort(
    (a, b) => FAMILIES.indexOf(a.family) - FAMILIES.indexOf(b.family) || compareCodes(a, b),
  );
}

// ---- The stash ----
// Saved shape (from PLAN.md): { "11/0": [ids...], "15/0": [ids...] }
// In memory we use a Set per size: quick to check "is this id in it?".

const STASH_KEY = 'bead-chart-app.stash';
const stash = loadStash();

function loadStash() {
  const result = Object.fromEntries(BEAD_SIZE_NAMES.map((size) => [size, new Set()]));
  try {
    const saved = JSON.parse(localStorage.getItem(STASH_KEY));
    for (const size of BEAD_SIZE_NAMES) {
      if (Array.isArray(saved?.[size])) saved[size].forEach((id) => result[size].add(id));
    }
  } catch (error) {
    console.warn('Could not load the stash:', error);
  }
  return result;
}

function saveStash() {
  const toSave = Object.fromEntries(BEAD_SIZE_NAMES.map((size) => [size, [...stash[size]]]));
  try {
    localStorage.setItem(STASH_KEY, JSON.stringify(toSave));
  } catch (error) {
    console.warn('Could not save the stash:', error);
  }
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
  return stash[size].size;
}

// The stash colours for one bead size, sorted by colour family.
export function stashColors(size) {
  const colors = [...stash[size]].map(getColor).filter(Boolean); // skip unknown ids
  return sortByFamily(colors);
}
