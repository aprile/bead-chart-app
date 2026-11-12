// Upgrading saved data from older versions of the app.
//
// Version 1 charts have no `version` and no `background`. Upgrading adds
// `version: 2` and the default background; nothing else changes, so v1
// charts open exactly as they were.

export const CHART_VERSION = 2;

// The page background colour, so charts look the same as before.
// (It isn't drawn yet: the background colour setting comes in a later milestone.)
export const DEFAULT_BACKGROUND = '#faf9f7';

// Returns an upgraded copy of a chart. Anything that isn't a chart object
// is returned as it is, so the normal check can reject it.
export function upgradeChart(chart) {
  if (chart === null || typeof chart !== 'object' || Array.isArray(chart)) return chart;
  if (chart.version === CHART_VERSION) return chart;
  if (chart.version !== undefined && chart.version !== 1) return chart; // unknown version: let the check reject it
  return {
    ...chart,
    version: CHART_VERSION,
    background: typeof chart.background === 'string' ? chart.background : DEFAULT_BACKGROUND,
  };
}
