// The "Calibration" screen: one card per bead size + stitch, where I type in
// a measurement of beadwork I've made, e.g. "20 beads across = 41 mm".

import {
  MIN_MM_PER_BEAD, MAX_MM_PER_BEAD, getCalibration, saveCalibration, resetCalibration,
} from './calibration.js';
import { STITCHES, specSpacing } from './stitches/index.js';
import { BEAD_SIZES } from './beads.js';

const BEAD_SIZE_NAMES = Object.keys(BEAD_SIZES);

// Show mm with up to 3 decimals: 2.05 mm, 1.36 mm.
const mm = (value) => `${Number(value.toFixed(3))} mm`;

// stitch = a stitch module (see stitches/index.js)
function cardHtml(stitch, beadSize) {
  const across = stitch.calibrationAcross;
  return `
    <form class="panel calibration-card" data-stitch="${stitch.id}" data-size="${beadSize}">
      <h3>${stitch.label} · ${beadSize} <span class="badge calibration-status"></span></h3>

      <div class="calibration-row">
        <span class="calibration-label">Width</span>
        <label><input type="number" name="colBeads" min="1" step="1" inputmode="numeric" /> ${across}</label>
        <label>= <input type="number" name="colMm" min="0" step="any" inputmode="decimal" /> mm</label>
        <span class="note calibration-result" data-for="columns"></span>
      </div>

      <div class="calibration-row">
        <span class="calibration-label">Height</span>
        <label><input type="number" name="rowBeads" min="1" step="1" inputmode="numeric" /> rows</label>
        <label>= <input type="number" name="rowMm" min="0" step="any" inputmode="decimal" /> mm</label>
        <span class="note calibration-result" data-for="rows"></span>
      </div>

      <p class="form-error" hidden></p>
      <div class="calibration-buttons">
        <button type="submit" class="primary">Save</button>
        <button type="button" data-action="reset">Reset to spec</button>
      </div>
    </form>`;
}

export function setupCalibrationScreen(root) {
  const list = root.querySelector('#calibration-list');
  list.innerHTML = STITCHES.flatMap((stitch) => BEAD_SIZE_NAMES.map((size) => cardHtml(stitch, size))).join('');

  // Read one measurement ("20 beads = 41 mm") from a card.
  // Returns null if both boxes are empty, or { error } if it doesn't make sense.
  function readPair(fields, beadsName, mmName) {
    const beadsText = fields[beadsName].value.trim();
    const mmText = fields[mmName].value.trim();
    if (!beadsText && !mmText) return null;
    const beads = Number(beadsText);
    const total = Number(mmText);
    if (!Number.isInteger(beads) || beads < 1) return { error: 'Enter a whole number of beads (1 or more).' };
    if (!(total > 0)) return { error: 'Enter the measured length in mm.' };
    const perBead = total / beads;
    if (perBead < MIN_MM_PER_BEAD || perBead > MAX_MM_PER_BEAD) {
      return { error: `That's ${mm(perBead)} per bead, which seems wrong. Check the numbers.` };
    }
    return { beads, mm: total };
  }

  // Show what each card is using now, and what the typed numbers work out to.
  function showCard(card) {
    const { stitch, size } = card.dataset;
    const spec = specSpacing(stitch, size);
    const saved = getCalibration(stitch, size);
    const fields = card.elements;

    const status = card.querySelector('.calibration-status');
    status.textContent = saved ? 'my measurement' : 'spec';
    status.classList.toggle('measured', Boolean(saved));
    card.querySelector('[data-action="reset"]').disabled = !saved;

    const describe = (savedMm, specMm, typed, what) => {
      if (typed && !typed.error) {
        const perBead = typed.mm / typed.beads;
        const isSaved = savedMm !== null && Math.abs(savedMm - perBead) < 1e-9;
        return `${mm(perBead)} per ${what}${isSaved ? ' · my measurement' : ' · not saved yet'}`;
      }
      if (savedMm !== null && savedMm !== undefined) return `${mm(savedMm)} per ${what} · my measurement`;
      return `${mm(specMm)} per ${what} · spec`;
    };
    card.querySelector('[data-for="columns"]').textContent = describe(
      saved?.mmPerColumn ?? null, spec.columnWidth, readPair(fields, 'colBeads', 'colMm'), 'column',
    );
    card.querySelector('[data-for="rows"]').textContent = describe(
      saved?.mmPerRow ?? null, spec.rowHeight, readPair(fields, 'rowBeads', 'rowMm'), 'row',
    );
  }

  // Fill the boxes with what I measured before (or leave them empty).
  function fillCard(card) {
    const { stitch, size } = card.dataset;
    const measured = getCalibration(stitch, size)?.measured;
    const fields = card.elements;
    fields.colBeads.value = measured?.columns?.beads ?? '';
    fields.colMm.value = measured?.columns?.mm ?? '';
    fields.rowBeads.value = measured?.rows?.beads ?? '';
    fields.rowMm.value = measured?.rows?.mm ?? '';
    card.querySelector('.form-error').hidden = true;
    showCard(card);
  }

  for (const card of list.querySelectorAll('form')) {
    fillCard(card);
    card.addEventListener('input', () => showCard(card));

    card.addEventListener('submit', (event) => {
      event.preventDefault();
      const fields = card.elements;
      const columns = readPair(fields, 'colBeads', 'colMm');
      const rows = readPair(fields, 'rowBeads', 'rowMm');
      const error = card.querySelector('.form-error');
      const problem = columns?.error ?? rows?.error;
      if (problem) {
        error.textContent = problem;
        error.hidden = false;
        return;
      }
      error.hidden = true;
      saveCalibration(card.dataset.stitch, card.dataset.size, { columns, rows });
      showCard(card);
    });

    card.querySelector('[data-action="reset"]').addEventListener('click', () => {
      resetCalibration(card.dataset.stitch, card.dataset.size);
      fillCard(card);
    });
  }
}
