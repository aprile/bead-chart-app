// The drawing tools in the left panel: brush and eraser.
// The brush paints with the colour chosen in the palette.

import { getColor, colorLabel } from './colors.js';

// root: the left panel. Its tool buttons have data-tool="brush" / "eraser".
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

  return {
    getTool: () => tool,
    setTool,
    showColor,
  };
}
