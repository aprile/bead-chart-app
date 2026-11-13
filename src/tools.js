// The drawing tools in the left panel:
// - brush: paints with the colour chosen in the palette
// - eraser: empties beads
// - fill: paints all the joined beads of one colour (see fill.js)
// - picker: click a bead to choose its colour in the palette
// - select: drag a rectangle of beads (see selection.js and main.js)

import { getColor, colorLabel } from './colors.js';

// root: the left panel. Its tool buttons have data-tool="brush", "eraser", "fill", "picker" or "select".
export function setupTools(root) {
  const buttons = root.querySelectorAll('[data-tool]');
  const swatch = root.querySelector('#current-swatch');
  const name = root.querySelector('#current-color-name');
  let tool = 'brush';

  function setTool(newTool) {
    tool = newTool;
    for (const button of buttons) {
      button.setAttribute('aria-pressed', button.dataset.tool === tool);
    }
  }

  for (const button of buttons) {
    button.addEventListener('click', () => setTool(button.dataset.tool));
  }

  // Show the brush colour under the tools (colorId null = no colour yet).
  function showColor(colorId) {
    const color = colorId && getColor(colorId);
    swatch.style.setProperty('--swatch', color ? color.hex : 'transparent');
    name.textContent = color ? colorLabel(color) : 'No colour chosen';
  }

  // A short message in place of the colour name, e.g. from the picker.
  // It stays until the colour changes.
  function showMessage(text) {
    name.textContent = text;
  }

  return {
    getTool: () => tool,
    setTool,
    showColor,
    showMessage,
  };
}
