// Upgrading saved data from older versions of the app.
//
// Version 1 charts have no `version` and no background bead. Upgrading adds
// `version: 2` and no background bead; nothing else changes, so v1 charts
// open exactly as they were.
//
// Early version 2 charts had `background` (a canvas colour, never used).
// It's replaced by `backgroundBead`: a colour id, or null for none.

export const CHART_VERSION = 2;

// Returns an upgraded copy of a chart. Anything that isn't a chart object
// is returned as it is, so the normal check can reject it.
export function upgradeChart(chart) {
  if (chart === null || typeof chart !== 'object' || Array.isArray(chart)) return chart;
  const known = chart.version === undefined || chart.version === 1 || chart.version === CHART_VERSION;
  if (!known) return chart; // unknown version: let the check reject it
  if (chart.version === CHART_VERSION && Object.hasOwn(chart, 'backgroundBead')) return chart; // already up to date
  const { background, ...rest } = chart; // drop the old, unused canvas colour
  return { ...rest, version: CHART_VERSION, backgroundBead: null };
}
