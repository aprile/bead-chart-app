// The "New chart" form: reads what you type and shows the bead count.

import { calculateChartSize } from './sizing.js';
import { BEAD_SIZES } from './beads.js';
import { load, save } from './storage.js';

const MM_PER_UNIT = { mm: 1, cm: 10 };

// The last stitch and bead size I picked, remembered across refreshes.
// Saved shape: { stitch: "brick", beadSize: "15/0" }
const CHOICES_KEY = 'bead-chart-app.lastChoices';

// Show a mm value in the chosen unit, e.g. 20.4 mm → "2.04 cm".
function formatLength(mm, unit) {
  const value = mm / MM_PER_UNIT[unit];
  // toFixed(2) gives 2 decimals; Number(...) drops trailing zeros (2.50 → 2.5).
  return `${Number(value.toFixed(2))} ${unit}`;
}

// onChange(settings) runs every time the form changes to valid numbers.
// onEditEnd() runs when you finish an edit (leave a field, click a radio…).
export function setupNewChartPanel(form, { onChange, onEditEnd }) {
  const result = form.querySelector('#size-result');
  const fields = form.elements; // every named input, e.g. fields.width

  function saveChoices() {
    save(CHOICES_KEY, { stitch: fields.stitch.value, beadSize: fields.beadSize.value });
  }

  // Put back the saved choices, but only if they're still valid options.
  const saved = load(CHOICES_KEY);
  if (['loom', 'brick'].includes(saved?.stitch)) fields.stitch.value = saved.stitch;
  if (saved?.beadSize in BEAD_SIZES) fields.beadSize.value = saved.beadSize;

  // Read the form. Returns null if the width or height isn't a number above 0.
  function readSettings() {
    const unit = fields.unit.value;
    const width = parseFloat(fields.width.value);
    const height = parseFloat(fields.height.value);
    if (!(width > 0) || !(height > 0)) return null;

    const settings = {
      stitch: fields.stitch.value,
      beadSize: fields.beadSize.value,
      widthMm: width * MM_PER_UNIT[unit],
      heightMm: height * MM_PER_UNIT[unit],
    };
    const size = calculateChartSize(settings);
    return { ...settings, cols: size.cols, rows: size.rows };
  }

  function showResult(settings) {
    const unit = fields.unit.value;
    const size = calculateChartSize(settings);
    const overhangNote = settings.stitch === 'brick' ? ' (incl. half-bead overhang)' : '';
    result.innerHTML = `
      <p class="bead-count"><strong>${size.cols}</strong> beads across × <strong>${size.rows}</strong> rows</p>
      <p>Real finished size: ${formatLength(size.realWidthMm, unit)}${overhangNote}
        × ${formatLength(size.realHeightMm, unit)}</p>
    `;
  }

  // 'input' fires on every keystroke and every radio/select change.
  form.addEventListener('input', () => {
    saveChoices();
    const settings = readSettings();
    if (!settings) {
      result.textContent = 'Enter a width and height above 0.';
      return; // the chart keeps its last valid size
    }
    showResult(settings);
    onChange(settings);
  });

  // 'change' fires when an edit is finished.
  form.addEventListener('change', onEditEnd);

  // Stop Enter from reloading the page (the form's default behaviour).
  form.addEventListener('submit', (event) => event.preventDefault());

  return {
    readSettings,
    // Put a chart's settings back into the form (used by undo/redo).
    // Setting .value from code doesn't fire 'input', so this won't loop.
    showChart(chart) {
      const unit = fields.unit.value;
      fields.stitch.value = chart.stitch;
      fields.beadSize.value = chart.beadSize;
      fields.width.value = Number((chart.widthMm / MM_PER_UNIT[unit]).toFixed(4));
      fields.height.value = Number((chart.heightMm / MM_PER_UNIT[unit]).toFixed(4));
      saveChoices(); // undo/redo can change the stitch or size too
      showResult(chart);
    },
  };
}
