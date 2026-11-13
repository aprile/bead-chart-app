// The "Background bead" section in the Chart tab: the colour every empty
// bead is stitched in. It's saved in the chart (chart.backgroundBead) and
// drawn by grid.js.
//
// - "Use brush colour" makes the brush colour (chosen in the palette) the background.
// - "None" goes back to plain grey empty beads.

import { getColor, colorLabel } from './colors.js';

// getBrushColorId(): the palette's colour (or null).
// onChoose(colorId): the background should change to colorId (null = none).
export function setupBackgroundBead(root, { getBrushColorId, onChoose }) {
  const swatch = root.querySelector('#background-swatch');
  const name = root.querySelector('#background-name');
  const useBrush = root.querySelector('#background-use-brush');
  const none = root.querySelector('#background-none');
  let current = null;

  useBrush.addEventListener('click', () => onChoose(getBrushColorId()));
  none.addEventListener('click', () => onChoose(null));

  // Show the chart's background bead and which buttons can be used right now.
  // Called after every redraw, and when the brush colour changes.
  function show(chart) {
    current = chart.backgroundBead;
    const color = current && getColor(current);
    swatch.style.setProperty('--swatch', color ? color.hex : 'transparent');
    name.textContent = color ? colorLabel(color) : 'None';
    const brush = getBrushColorId();
    useBrush.disabled = !brush || brush === current;
    none.disabled = current === null;
  }

  return { show };
}
