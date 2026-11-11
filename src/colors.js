// Looks up colours from the generated Miyuki list (read only, never edited).
// Milestone 4 will add stash, custom colours and overrides here.

import data from './data/miyuki-colors.json';

const colorsById = new Map(data.colors.map((color) => [color.id, color]));

export function getColor(id) {
  return colorsById.get(id);
}
