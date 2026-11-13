// The "Export picture" dialog: options on the right, a live preview on the
// left, and Download PNG. The options are remembered for next time
// (except "turned sideways", which starts the way the chart is shown).

import { renderPicture, downloadPicture } from './picture-export.js';
import { getStitch } from './stitches/index.js';
import { load, save, STORAGE_KEYS } from './storage.js';

const DEFAULTS = { beadPx: 24, gridLines: true, key: true, transparent: false };

function loadOptions() {
  const saved = load(STORAGE_KEYS.pictureExport) ?? {};
  const beadPx = Number.isInteger(saved.beadPx) && saved.beadPx >= 6 && saved.beadPx <= 64 ? saved.beadPx : DEFAULTS.beadPx;
  const flag = (name) => (typeof saved[name] === 'boolean' ? saved[name] : DEFAULTS[name]);
  return { beadPx, gridLines: flag('gridLines'), key: flag('key'), transparent: flag('transparent') };
}

// dialog: the <dialog>. getChart(): the open chart. isSideways(): is it shown turned?
export function setupPictureDialog(dialog, { getChart, isSideways }) {
  const form = dialog.querySelector('.picture-options');
  const fields = form.elements;
  const preview = dialog.querySelector('.picture-preview');
  const sizeText = dialog.querySelector('.picture-size');
  let picture = null; // the last rendered picture
  let waiting = false;

  function readOptions() {
    return {
      beadPx: Number(fields.beadPx.value),
      gridLines: fields.gridLines.checked && !fields.gridLines.disabled,
      key: fields.key.checked,
      transparent: fields.transparent.checked,
      sideways: fields.sideways.checked,
    };
  }

  function update() {
    waiting = false;
    const options = readOptions();
    fields.beadPxValue.value = `${options.beadPx} px`;
    const result = renderPicture(getChart(), options);
    picture = result.canvas;
    preview.replaceChildren(picture);
    const { width, height } = picture;
    sizeText.textContent = `${width} × ${height} pixels` +
      (result.shrunk ? ` (beads made smaller, ${result.beadPx} px, so the picture isn't too big for the browser)` : '');
    const { sideways, ...remembered } = options;
    save(STORAGE_KEYS.pictureExport, remembered);
  }

  // Redraw at most once per screen frame while a slider is being dragged.
  form.addEventListener('input', () => {
    if (waiting) return;
    waiting = true;
    requestAnimationFrame(update);
  });

  dialog.querySelector('[data-action="download"]').addEventListener('click', () => {
    if (picture) downloadPicture(picture, getChart().name);
    dialog.close();
  });
  for (const button of dialog.querySelectorAll('[data-action="cancel"]')) {
    button.addEventListener('click', () => dialog.close());
  }

  return {
    open() {
      const options = loadOptions();
      const stitch = getStitch(getChart().stitch);
      fields.beadPx.value = options.beadPx;
      fields.beadPx.dispatchEvent(new Event('input')); // Basecoat fills the slider track
      // Only some stitches have grid lines (the stitch module says which).
      fields.gridLines.disabled = !stitch.gridLines;
      fields.gridLines.checked = options.gridLines && stitch.gridLines;
      fields.key.checked = options.key;
      fields.transparent.checked = options.transparent;
      fields.sideways.checked = isSideways();
      dialog.showModal();
      update();
    },
  };
}
