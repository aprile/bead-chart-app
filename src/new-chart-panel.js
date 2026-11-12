// The chart size form: finished width × height, or bead columns × rows.
// The two are linked: change the width and the column count follows; change
// the column count and the width follows (the same for height and rows).

import { calculateChartSize, realSize, formatLength, MM_PER_UNIT } from './sizing.js';
import { BEAD_SIZES } from './beads.js';
import { load, save, STORAGE_KEYS } from './storage.js';
import { STITCHES, getStitch, isStitch } from './stitches/index.js';

// The last stitch and bead size I picked, remembered across refreshes.
// Saved shape: { stitch: "brick", beadSize: "15/0" }
const CHOICES_KEY = STORAGE_KEYS.lastChoices;

// More beads than this would make the app slow.
const MAX_BEADS = 1000;

// onChange(settings) runs every time the form changes to valid numbers.
// onEditEnd() runs when you finish an edit (leave a field, pick from a list…).
export function setupNewChartPanel(form, { onChange, onEditEnd }) {
  // One choice per stitch module (the first one is picked to start with).
  form.querySelector('#stitch').innerHTML = STITCHES.map(
    (stitch) => `<option value="${stitch.id}">${stitch.label}</option>`,
  ).join('');

  const result = form.querySelector('#size-result');
  const fields = form.elements; // every named input, e.g. fields.width

  // Which box I typed in last, for each direction: the size ("size") or the
  // bead count ("count"). That one stays fixed when the stitch or bead size
  // changes, and the other one is worked out from it.
  const typedLast = { across: 'size', down: 'size' };

  let unit = fields.unit.value; // remembered, so a unit change can convert the numbers

  function saveChoices() {
    save(CHOICES_KEY, { stitch: fields.stitch.value, beadSize: fields.beadSize.value });
  }

  // Put back the saved choices, but only if they're still valid options.
  const saved = load(CHOICES_KEY);
  if (isStitch(saved?.stitch)) fields.stitch.value = saved.stitch;
  if (Object.hasOwn(BEAD_SIZES, saved?.beadSize)) fields.beadSize.value = saved.beadSize;

  // A length in mm, shown in the form's unit (2 decimals for cm, 1 for mm).
  function showLength(input, mm) {
    input.value = Number((mm / MM_PER_UNIT[unit]).toFixed(unit === 'cm' ? 2 : 1));
  }

  // Read the form. Returns { settings } or { error }.
  // settings = { stitch, beadSize, widthMm, heightMm, cols, rows }
  function read() {
    const stitch = fields.stitch.value;
    const beadSize = fields.beadSize.value;
    let { cols, rows, widthMm, heightMm } = {};

    // The box I typed in last is the one we trust, in each direction.
    if (typedLast.across === 'count') {
      cols = Number(fields.cols.value);
      if (!Number.isInteger(cols) || cols < 1) return { error: 'Enter a whole number of columns (1 or more).' };
    } else {
      widthMm = parseFloat(fields.width.value) * MM_PER_UNIT[unit];
      if (!(widthMm > 0)) return { error: 'Enter a width above 0.' };
    }
    if (typedLast.down === 'count') {
      rows = Number(fields.rows.value);
      if (!Number.isInteger(rows) || rows < 1) return { error: 'Enter a whole number of rows (1 or more).' };
    } else {
      heightMm = parseFloat(fields.height.value) * MM_PER_UNIT[unit];
      if (!(heightMm > 0)) return { error: 'Enter a height above 0.' };
    }

    // Work out the other one: size → bead count, or bead count → real size.
    const fromSize = calculateChartSize({ stitch, beadSize, widthMm: widthMm ?? 1, heightMm: heightMm ?? 1 });
    cols ??= fromSize.cols;
    rows ??= fromSize.rows;
    if (cols > MAX_BEADS || rows > MAX_BEADS) {
      return { error: `That's more than ${MAX_BEADS} beads in one direction. Try a smaller size.` };
    }
    const real = realSize({ stitch, beadSize, cols, rows });
    widthMm ??= real.realWidthMm;
    heightMm ??= real.realHeightMm;

    return { settings: { stitch, beadSize, widthMm, heightMm, cols, rows } };
  }

  function readSettings() {
    return read().settings ?? null;
  }

  // Fill in the boxes I'm NOT typing in, so everything matches.
  function updateLinkedBoxes(settings) {
    if (typedLast.across === 'count') showLength(fields.width, settings.widthMm);
    else fields.cols.value = settings.cols;
    if (typedLast.down === 'count') showLength(fields.height, settings.heightMm);
    else fields.rows.value = settings.rows;
  }

  // settings has cols and rows. The real size comes from those bead counts,
  // so a saved chart keeps its counts even if my calibration changes.
  function showResult(settings) {
    const size = realSize(settings);
    const { overhang } = getStitch(settings.stitch);
    const note = ' (incl. half-bead overhang)';
    result.innerHTML = `
      <p class="bead-count"><strong>${settings.cols}</strong> beads across × <strong>${settings.rows}</strong> rows</p>
      <p>Real finished size: ${formatLength(size.realWidthMm, unit)}${overhang.across ? note : ''}
        × ${formatLength(size.realHeightMm, unit)}${overhang.down ? note : ''}</p>
    `;
  }

  // 'input' fires on every keystroke and every change of a list (select).
  form.addEventListener('input', (event) => {
    const name = event.target.name;
    if (name === 'width') typedLast.across = 'size';
    if (name === 'cols') typedLast.across = 'count';
    if (name === 'height') typedLast.down = 'size';
    if (name === 'rows') typedLast.down = 'count';

    if (name === 'unit') {
      // Same size, different unit: convert the numbers (2 cm → 20 mm).
      const factor = MM_PER_UNIT[unit] / MM_PER_UNIT[fields.unit.value];
      unit = fields.unit.value;
      for (const input of [fields.width, fields.height]) {
        const value = parseFloat(input.value);
        if (value > 0) input.value = Number((value * factor).toFixed(4));
      }
      const settings = readSettings();
      if (settings) showResult(settings);
      return; // nothing about the chart changed
    }

    saveChoices();
    const { settings, error } = read();
    if (error) {
      result.textContent = error;
      return; // the chart keeps its last valid size
    }
    updateLinkedBoxes(settings);
    showResult(settings);
    onChange(settings);
  });

  // 'change' fires when an edit is finished.
  form.addEventListener('change', onEditEnd);

  // Stop Enter from reloading the page (the form's default behaviour).
  form.addEventListener('submit', (event) => event.preventDefault());

  // Fill the form from the starting values.
  const first = readSettings();
  if (first) updateLinkedBoxes(first);

  return {
    readSettings,
    // Put a chart's settings into the form (opening a chart, undo/redo).
    // Setting .value from code doesn't fire 'input', so this won't loop.
    showChart(chart) {
      fields.stitch.value = chart.stitch;
      fields.beadSize.value = chart.beadSize;
      fields.cols.value = chart.cols;
      fields.rows.value = chart.rows;
      // The chart's bead counts are what matter. If its saved size no longer
      // gives those counts (e.g. my calibration changed), show the real size
      // instead, so the boxes still agree with each other.
      const fromSize = calculateChartSize(chart);
      const real = realSize(chart);
      typedLast.across = fromSize.cols === chart.cols ? 'size' : 'count';
      typedLast.down = fromSize.rows === chart.rows ? 'size' : 'count';
      // A size I typed is shown exactly; a worked-out size is rounded.
      const exact = (input, mm) => (input.value = Number((mm / MM_PER_UNIT[unit]).toFixed(4)));
      if (typedLast.across === 'size') exact(fields.width, chart.widthMm);
      else showLength(fields.width, real.realWidthMm);
      if (typedLast.down === 'size') exact(fields.height, chart.heightMm);
      else showLength(fields.height, real.realHeightMm);
      saveChoices(); // undo/redo can change the stitch or size too
      showResult(chart);
    },
  };
}
