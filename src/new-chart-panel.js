// The "New chart" form: reads what you type and shows the bead count.

import { calculateChartSize } from './sizing.js';

const MM_PER_UNIT = { mm: 1, cm: 10 };

// Show a mm value in the chosen unit, e.g. 20.4 mm → "2.04 cm".
function formatLength(mm, unit) {
  const value = mm / MM_PER_UNIT[unit];
  // toFixed(2) gives 2 decimals; Number(...) drops trailing zeros (2.50 → 2.5).
  return `${Number(value.toFixed(2))} ${unit}`;
}

// onChange is called with the new chart size every time the form changes
// (or with null if the numbers aren't valid).
export function setupNewChartPanel(form, onChange) {
  const result = form.querySelector('#size-result');

  function update() {
    // FormData reads every named input in the form.
    const data = new FormData(form);
    const unit = data.get('unit');
    const width = parseFloat(data.get('width'));
    const height = parseFloat(data.get('height'));

    if (!(width > 0) || !(height > 0)) {
      result.textContent = 'Enter a width and height above 0.';
      onChange(null);
      return;
    }

    const stitch = data.get('stitch');
    const beadSize = data.get('beadSize');
    const size = calculateChartSize({
      stitch,
      beadSize,
      widthMm: width * MM_PER_UNIT[unit],
      heightMm: height * MM_PER_UNIT[unit],
    });

    const overhangNote = stitch === 'brick' ? ' (incl. half-bead overhang)' : '';

    result.innerHTML = `
      <p class="bead-count"><strong>${size.cols}</strong> beads across × <strong>${size.rows}</strong> rows</p>
      <p>Real finished size: ${formatLength(size.realWidthMm, unit)}${overhangNote}
        × ${formatLength(size.realHeightMm, unit)}</p>
    `;

    onChange({ stitch, beadSize, cols: size.cols, rows: size.rows });
  }

  // 'input' fires on every keystroke and every radio/select change.
  form.addEventListener('input', update);
  // Stop Enter from reloading the page (the form's default behaviour).
  form.addEventListener('submit', (event) => event.preventDefault());

  update(); // show a result straight away for the starting values
}
