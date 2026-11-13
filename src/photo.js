// "Import photo": pick an image, place a crop box with the chart's shape,
// choose the colours, adjust the photo, then Apply (one undo step) or Cancel.
//
// The work is split in two so sliders stay quick:
// 1. When the crop box moves: find each bead's most common colour (slower).
// 2. On any setting change: adjust those colours, remove the background,
//    choose the N best colours, match every bead (fast).
//
// The colours come from my stash, or (with "Only colours in my stash" off)
// from every colour made in the chart's bead size.

import { preparePhoto, sampleBeadColors, chartShape, adjustColor, pickColorAt } from './photo-sampling.js';
import { createColorMatcher, chooseColors } from './color-match.js';
import { rgbToLab, rgbToHex } from './color-math.js';
import { stashColors, allColors, sortByFamily, getColor, colorLabel } from './colors.js';
import { drawPreview } from './grid.js';
import { formatLength } from './sizing.js';
import { escapeHtml } from './html.js';

const PREVIEW_MAX_WIDTH = 280;
const CONTROLS_WIDTH = 320;

// getChart() → the open chart; onApply(beads) → put the new beads in the chart.
export function setupPhotoImport({ button, fileInput, getChart, onApply }) {
  const dialog = document.querySelector('#photo-dialog');
  const stage = dialog.querySelector('.photo-stage');
  const cropBox = dialog.querySelector('.crop-box');
  const previewCanvas = dialog.querySelector('.photo-preview');
  const summary = dialog.querySelector('.photo-summary');
  const shapeText = dialog.querySelector('.photo-shape');
  const controls = dialog.querySelector('#photo-controls');
  const fields = controls.elements;
  const chosenList = dialog.querySelector('.chosen-colors');
  const backgroundSwatch = dialog.querySelector('.background-swatch');
  const pickingNote = dialog.querySelector('.picking-note');

  let photo = null; // the shrunk photo (a canvas), shown in the stage
  let chart = null; // the open chart, when the dialog was opened
  let stash = []; // stash colours for the chart's bead size
  let everyColor = []; // every colour (Miyuki and mine) made in the chart's bead size
  let aspect = 1; // crop box width ÷ height (the chart's real shape)
  let box = null; // crop box { x, y, w, h } in photo pixels

  let sampled = null; // step 1 result: rows of [r, g, b], one per bead
  let beads = null; // step 2 result: rows of colour ids (or null), ready to apply
  let chosen = []; // the colours picked for this photo
  let locked = []; // ids I locked (or swapped in): always used
  let excluded = new Set(); // ids I swapped out: never used this time
  let background = null; // [r, g, b] picked from the photo, or null
  let picking = false; // waiting for a click on the photo to pick the background
  let slow = false; // if step 1 is slow, only redo it when you let go of the box

  // ---------- Opening ----------

  button.addEventListener('click', () => {
    chart = getChart();
    stash = stashColors(chart.beadSize);
    everyColor = sortByFamily(allColors().filter((color) => color.sizes.includes(chart.beadSize)));
    // With no stash colours in this size, the photo can only use "every colour".
    const noStash = stash.length === 0;
    if (noStash) fields.onlyStash.checked = false;
    fields.onlyStash.disabled = noStash;
    fields.onlyStash.parentElement.title = noStash
      ? `Your stash has no ${chart.beadSize} colours yet`
      : 'Turn off to use any Miyuki colour in this bead size';
    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = ''; // so picking the same file again still works
    if (!file) return;

    const image = new Image();
    const url = URL.createObjectURL(file);
    try {
      image.src = url;
      await image.decode(); // wait until the browser has read the image
      photo = preparePhoto(image);
    } catch {
      alert("Couldn't open this image. Try a JPEG or PNG.");
      return;
    } finally {
      URL.revokeObjectURL(url);
    }
    open();
  });

  function open() {
    const shape = chartShape(chart);
    aspect = shape.aspect;
    shapeText.textContent = `${formatLength(shape.widthMm, 'cm')} × ${formatLength(shape.heightMm, 'cm')}`;

    // Start with the biggest box that fits, in the middle of the photo.
    const w = Math.min(photo.width, photo.height * aspect);
    const h = w / aspect;
    box = { x: (photo.width - w) / 2, y: (photo.height - h) / 2, w, h };

    // New photo: forget the last photo's colour choices and background.
    // (The slider positions are kept.)
    locked = [];
    excluded = new Set();
    background = null;
    fields.removeBackground.checked = false;
    setPicking(false);
    shownChosenKey = '';

    stage.querySelector('canvas')?.remove();
    stage.prepend(photo);
    dialog.showModal();
    sizePhoto();
    renderBox();
    update(true);
  }

  // Fit the photo on screen, with room for the preview and the settings when there's space.
  function sizePhoto() {
    const panesWidth = dialog.querySelector('.photo-panes').clientWidth;
    let maxWidth = panesWidth;
    if (panesWidth >= 1000) maxWidth -= PREVIEW_MAX_WIDTH + CONTROLS_WIDTH + 48;
    else if (panesWidth >= 640) maxWidth -= PREVIEW_MAX_WIDTH + 24;
    const maxHeight = window.innerHeight * 0.65;
    const scale = Math.min(maxWidth / photo.width, maxHeight / photo.height);
    photo.style.width = `${photo.width * scale}px`;
    photo.style.height = `${photo.height * scale}px`;
  }

  // ---------- Crop box ----------

  // How many screen pixels one photo pixel takes up right now.
  function displayScale() {
    return photo.getBoundingClientRect().width / photo.width;
  }

  function renderBox() {
    const scale = displayScale();
    cropBox.style.left = `${box.x * scale}px`;
    cropBox.style.top = `${box.y * scale}px`;
    cropBox.style.width = `${box.w * scale}px`;
    cropBox.style.height = `${box.h * scale}px`;
  }

  // Pointer position in photo pixels.
  function pointInPhoto(event) {
    const rect = photo.getBoundingClientRect();
    const scale = photo.width / rect.width;
    return { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale };
  }

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  // Resize from a corner, keeping the opposite corner still and the shape locked.
  function resizeFrom(corner, start, point) {
    const left = corner.includes('w'); // dragging a left-hand corner (nw, sw)
    const top = corner.includes('n'); // dragging a top corner (nw, ne)
    const anchorX = left ? start.x + start.w : start.x;
    const anchorY = top ? start.y + start.h : start.y;

    // The box can't go past the photo's edges.
    const roomX = left ? anchorX : photo.width - anchorX;
    const roomY = top ? anchorY : photo.height - anchorY;
    const maxW = Math.min(roomX, roomY * aspect);
    const minW = Math.min(maxW, 24 / displayScale()); // at least 24 screen pixels wide

    const wanted = Math.max(Math.abs(point.x - anchorX), Math.abs(point.y - anchorY) * aspect);
    const w = clamp(wanted, minW, maxW);
    const h = w / aspect;
    return { x: left ? anchorX - w : anchorX, y: top ? anchorY - h : anchorY, w, h };
  }

  let drag = null; // { corner (or null to move), start point, start box }

  cropBox.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    cropBox.setPointerCapture(event.pointerId);
    const handle = event.target.closest('.crop-handle');
    drag = { corner: handle?.dataset.corner ?? null, startPoint: pointInPhoto(event), startBox: { ...box } };
  });

  cropBox.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const point = pointInPhoto(event);
    if (drag.corner) {
      box = resizeFrom(drag.corner, drag.startBox, point);
    } else {
      const dx = point.x - drag.startPoint.x;
      const dy = point.y - drag.startPoint.y;
      box = {
        ...box,
        x: clamp(drag.startBox.x + dx, 0, photo.width - box.w),
        y: clamp(drag.startBox.y + dy, 0, photo.height - box.h),
      };
    }
    renderBox();
    if (!slow) scheduleUpdate(true);
  });

  function endDrag() {
    if (!drag) return;
    drag = null;
    scheduleUpdate(true);
  }
  cropBox.addEventListener('pointerup', endDrag);
  cropBox.addEventListener('pointercancel', endDrag);

  // ---------- Picking the background colour ----------

  function setPicking(on) {
    picking = on;
    stage.classList.toggle('picking', on); // lets clicks go through the crop box to the photo
    pickingNote.hidden = !on;
  }

  controls.querySelector('[data-action="pick-background"]').addEventListener('click', () => setPicking(!picking));

  stage.addEventListener('pointerdown', (event) => {
    if (!picking || event.target !== photo) return;
    const point = pointInPhoto(event);
    background = pickColorAt(photo, point.x, point.y);
    fields.removeBackground.checked = true;
    setPicking(false);
    scheduleUpdate(false);
  });

  // Esc while picking stops picking, instead of closing the whole dialog.
  dialog.addEventListener('cancel', (event) => {
    if (picking) {
      event.preventDefault();
      setPicking(false);
    }
  });

  // ---------- Settings ----------

  // The colours the photo may use right now.
  function availableColors() {
    return fields.onlyStash.checked ? stash : everyColor;
  }

  function readSettings() {
    return {
      cap: Number(fields.cap.value),
      brightness: Number(fields.brightness.value),
      contrast: Number(fields.contrast.value),
      saturation: Number(fields.saturation.value),
      removeBackground: fields.removeBackground.checked && background !== null,
      tolerance: Number(fields.tolerance.value),
      showSampled: fields.showSampled.checked,
    };
  }

  // Any slider or checkbox: show its number and update the preview.
  controls.addEventListener('input', (event) => {
    if (event.target.closest('.chosen-colors')) return; // swap menus are handled below
    if (event.target === fields.onlyStash && fields.onlyStash.checked) {
      // Back to my stash only: forget colours I locked or swapped in from outside it.
      const inStash = new Set(stash.map((color) => color.id));
      locked = locked.filter((id) => inStash.has(id));
    }
    for (const name of ['cap', 'brightness', 'contrast', 'saturation', 'tolerance']) {
      fields[`${name}Value`].value = fields[name].value;
    }
    scheduleUpdate(false);
  });

  // This checkbox is outside the form on the page, so it needs its own listener.
  fields.showSampled.addEventListener('change', () => scheduleUpdate(false));

  controls.querySelector('[data-action="reset-adjust"]').addEventListener('click', () => {
    for (const name of ['brightness', 'contrast', 'saturation']) {
      fields[name].value = 0;
      fields[`${name}Value`].value = 0;
      // Tell Basecoat the slider moved, so the filled part of its track follows.
      // (Not "bubbling", so the form's own input listener above doesn't run too.)
      fields[name].dispatchEvent(new Event('input'));
    }
    scheduleUpdate(false);
  });

  // ---------- Chosen colours: lock and swap ----------

  let shownChosenKey = ''; // what the list shows now, so we only rebuild it when it changes

  function renderChosen(counts) {
    const key = chosen.map((c) => c.id).join() + '|' + locked.join() + '|' + fields.onlyStash.checked;
    if (key !== shownChosenKey) {
      shownChosenKey = key;
      // One shared list of options for every "swap" menu. With every colour
      // allowed, my stash comes first, then the rest.
      const optionsFor = (colors) =>
        colors.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(colorLabel(c))}</option>`).join('');
      let options;
      if (fields.onlyStash.checked) {
        options = optionsFor(stash);
      } else {
        const inStash = new Set(stash.map((color) => color.id));
        options =
          (stash.length > 0 ? `<optgroup label="My stash">${optionsFor(stash)}</optgroup>` : '') +
          `<optgroup label="Other colours">${optionsFor(everyColor.filter((c) => !inStash.has(c.id)))}</optgroup>`;
      }
      chosenList.innerHTML = chosen
        .map((color) => {
          const isLocked = locked.includes(color.id);
          return `
            <li data-id="${escapeHtml(color.id)}">
              <span class="swatch-inline" style="background: ${escapeHtml(color.hex)}"></span>
              <span class="chosen-name">
                ${escapeHtml(colorLabel(color))}
                <small class="bead-count"></small>
              </span>
              <button type="button" class="btn lock" data-variant="outline" data-size="xs" data-action="lock" aria-pressed="${isLocked}"
                title="Locked colours are always used">${isLocked ? 'Locked' : 'Lock'}</button>
              <select class="select" data-action="swap" aria-label="Swap ${escapeHtml(colorLabel(color))} for another colour">
                <option value="">Swap…</option>${options}
              </select>
            </li>`;
        })
        .join('');
    }
    for (const li of chosenList.children) {
      const n = counts.get(li.dataset.id) ?? 0;
      li.querySelector('.bead-count').textContent = `${n} bead${n === 1 ? '' : 's'}`;
    }
  }

  chosenList.addEventListener('click', (event) => {
    const lockButton = event.target.closest('[data-action="lock"]');
    if (!lockButton) return;
    const id = lockButton.closest('li').dataset.id;
    locked = locked.includes(id) ? locked.filter((l) => l !== id) : [...locked, id];
    scheduleUpdate(false);
  });

  // Swapping = never use the old colour this time, and always use the new one.
  chosenList.addEventListener('change', (event) => {
    const select = event.target.closest('[data-action="swap"]');
    if (!select?.value) return;
    const oldId = select.closest('li').dataset.id;
    const newId = select.value;
    if (newId !== oldId) excluded.add(oldId);
    excluded.delete(newId);
    locked = locked.filter((id) => id !== oldId);
    if (!locked.includes(newId)) locked.push(newId);
    scheduleUpdate(false);
  });

  // ---------- Updating the preview ----------

  // At most one update per screen refresh, however fast the mouse or slider moves.
  let updateWaiting = false;
  let resampleWaiting = false;
  function scheduleUpdate(resample) {
    resampleWaiting ||= resample;
    if (updateWaiting) return;
    updateWaiting = true;
    requestAnimationFrame(() => {
      updateWaiting = false;
      const resampleNow = resampleWaiting;
      resampleWaiting = false;
      update(resampleNow);
    });
  }

  function update(resample) {
    // Step 1 (only when the crop box moved): each bead's most common colour.
    if (resample || !sampled) {
      const started = performance.now();
      sampled = sampleBeadColors(photo, box, chart);
      // If this took longer than ~1/25 s, wait until you let go of the box next time.
      slow = performance.now() - started > 40;
    }

    // Step 2: adjust, remove background, choose colours, match.
    const settings = readSettings();
    const backgroundLab = settings.removeBackground ? rgbToLab(background) : null;
    const tolerance2 = settings.tolerance ** 2;
    const isBackground = (rgb) => {
      if (!backgroundLab) return false;
      const lab = rgbToLab(rgb);
      return (lab[0] - backgroundLab[0]) ** 2 + (lab[1] - backgroundLab[1]) ** 2 + (lab[2] - backgroundLab[2]) ** 2 <= tolerance2;
    };
    // The background is judged on the photo's real colours (the ones you clicked),
    // before brightness/contrast/saturation.
    const adjusted = sampled.map((row) => row.map((rgb) => (isBackground(rgb) ? null : adjustColor(rgb, settings))));

    const candidates = availableColors().filter((c) => !excluded.has(c.id));
    const lockedColors = locked.map(getColor).filter(Boolean);
    chosen = chooseColors(adjusted.flat().filter(Boolean), candidates, settings.cap, lockedColors);
    const nearest = chosen.length > 0 ? createColorMatcher(chosen) : null;
    beads = adjusted.map((row) => row.map((rgb) => (rgb && nearest ? nearest(rgb).id : null)));

    // Draw: either the matched bead colours, or (debug) the sampled colours.
    const maxHeight = photo.getBoundingClientRect().height;
    if (settings.showSampled) {
      drawPreview(previewCanvas, { ...chart, beads: adjusted }, PREVIEW_MAX_WIDTH, maxHeight, (rgb) => rgb && rgbToHex(rgb));
    } else {
      drawPreview(previewCanvas, { ...chart, beads }, PREVIEW_MAX_WIDTH, maxHeight);
    }

    const counts = new Map();
    let empty = 0;
    for (const id of beads.flat()) {
      if (id === null) empty++;
      else counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    renderChosen(counts);
    backgroundSwatch.style.background = background ? rgbToHex(background) : 'transparent';
    backgroundSwatch.classList.toggle('is-empty', !background);

    summary.textContent =
      `${chart.cols} × ${chart.rows} beads · ${chosen.length} colour${chosen.length === 1 ? '' : 's'}` +
      (empty > 0 ? ` · ${empty} empty (background)` : '');
  }

  // ---------- Apply / Cancel ----------

  dialog.querySelector('[data-action="apply"]').addEventListener('click', () => {
    onApply(beads);
    dialog.close();
  });
  // Cancel and the × in the corner.
  for (const button of dialog.querySelectorAll('[data-action="cancel"]')) {
    button.addEventListener('click', () => dialog.close());
  }
  controls.addEventListener('submit', (event) => event.preventDefault());

  // Keep the box in place if the window is resized while the dialog is open.
  window.addEventListener('resize', () => {
    if (dialog.open) {
      sizePhoto();
      renderBox();
      scheduleUpdate(false);
    }
  });
}
