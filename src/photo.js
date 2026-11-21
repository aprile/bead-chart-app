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
//
// If the picture has grid lines (a chart saved as an image, pixel art),
// "Follow the grid in the picture" is on: the box fits the grid, snaps to
// whole squares, and each square becomes one bead.

import { preparePhoto, sampleBeadColors, chartShape, adjustColor, pickColorAt } from './photo-sampling.js';
import { findGrid } from './grid-detect.js';
import { createColorMatcher, chooseColors } from './color-match.js';
import { rgbToLab, rgbToHex } from './color-math.js';
import { stashColors, allColors, sortByFamily, getColor, colorLabel } from './colors.js';
import { drawPreview } from './grid.js';
import { formatLength, beadSpacing } from './sizing.js';
import { getStitch } from './stitches/index.js';
import { escapeHtml } from './html.js';

const PREVIEW_MAX_WIDTH = 280;
const CONTROLS_WIDTH = 320;
const MAX_BEADS = 1000; // per direction, like the Chart tab

// getChart() → the open chart.
// onApply(beads, { cols, rows }) → put the new beads in the chart, at that size.
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
  const sizeNote = dialog.querySelector('.photo-size-note');
  const gridPanel = dialog.querySelector('.photo-grid');
  const gridNote = dialog.querySelector('.photo-grid-note');

  let photo = null; // the shrunk photo (a canvas), shown in the stage
  let chart = null; // the open chart, when the dialog was opened
  let stash = []; // stash colours for the chart's bead size
  let everyColor = []; // every colour (Miyuki and mine) made in the chart's bead size
  let size = null; // { cols, rows }: the chart size under Size (starts at the chart's own)
  let aspect = 1; // crop box width ÷ height (the real shape of that size)
  let box = null; // crop box { x, y, w, h } in photo pixels
  let grid = null; // the grid found in the picture (see grid-detect.js), or null
  let gridBox = null; // with the grid followed: the box's edges as line numbers { c0, c1, r0, r1 }

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
    // Grid lines in the picture? Then follow them to start with.
    grid = findGrid(photo);
    gridPanel.hidden = !grid;
    fields.useGrid.checked = grid !== null;
    if (grid) gridNote.textContent = `Found ${grid.x.count} × ${grid.y.count} squares. Each square becomes one bead.`;

    size = { cols: chart.cols, rows: chart.rows };
    fields.photoCols.value = size.cols;
    fields.photoRows.value = size.rows;
    if (onGrid()) {
      useWholeGrid();
    } else {
      showSize();
      // Start with the biggest box that fits, in the middle of the photo.
      const w = Math.min(photo.width, photo.height * aspect);
      const h = w / aspect;
      box = { x: (photo.width - w) / 2, y: (photo.height - h) / 2, w, h };
    }
    showGridMode();

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

  // ---------- Size (columns × rows) ----------

  // The chart as it will be after Apply: the open chart at the size under Size.
  function target() {
    return { ...chart, cols: size.cols, rows: size.rows };
  }

  // Show the finished size, and work out the crop box's shape from it.
  function showSize() {
    const shape = chartShape(target());
    if (!onGrid()) aspect = shape.aspect; // on the grid, the squares set the box's shape
    const finished = `${formatLength(shape.widthMm, 'cm')} × ${formatLength(shape.heightMm, 'cm')}`;
    shapeText.textContent = finished;
    sizeNote.classList.remove('error');
    sizeNote.textContent =
      size.cols === chart.cols && size.rows === chart.rows
        ? `Finished size ${finished}, the same as the chart.`
        : `Finished size ${finished}. Apply changes the chart to ${size.cols} × ${size.rows}.`;
  }

  // How many rows give the box's shape for this many columns (or the other
  // way round), counting the stitch's overhang and the bead shape.
  function matchingCount(count, from) {
    const { columnWidth, rowHeight } = beadSpacing(chart.stitch, chart.beadSize);
    const { overhang } = getStitch(chart.stitch);
    const result =
      from === 'cols'
        ? ((count + overhang.across) * columnWidth) / aspect / rowHeight - overhang.down
        : ((count + overhang.down) * rowHeight * aspect) / columnWidth - overhang.across;
    return clamp(Math.round(result), 1, MAX_BEADS);
  }

  // Typing in Columns or Rows. With "Keep the box's shape" on, the other box
  // follows; otherwise the box changes shape.
  function changeSize(changed) {
    const input = changed === 'cols' ? fields.photoCols : fields.photoRows;
    const value = Number(input.value);
    if (!Number.isInteger(value) || value < 1 || value > MAX_BEADS) {
      sizeNote.textContent = `Enter a whole number from 1 to ${MAX_BEADS}.`;
      sizeNote.classList.add('error');
      return; // keep the last good size
    }
    if (onGrid()) return changeGridSize(changed, value);
    size = { ...size, [changed]: value };
    if (fields.keepShape.checked) {
      const other = changed === 'cols' ? 'rows' : 'cols';
      size[other] = matchingCount(value, changed);
      (other === 'cols' ? fields.photoCols : fields.photoRows).value = size[other];
    }
    showSize();
    reshapeBox();
    scheduleUpdate(true);
  }

  // Give the crop box the new shape: about the same area, around the same
  // middle, and still inside the photo.
  function reshapeBox() {
    const middle = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    let w = Math.sqrt(box.w * box.h * aspect);
    w = Math.min(w, photo.width, photo.height * aspect);
    const h = w / aspect;
    box = {
      x: clamp(middle.x - w / 2, 0, photo.width - w),
      y: clamp(middle.y - h / 2, 0, photo.height - h),
      w,
      h,
    };
    renderBox();
  }

  // ---------- Following the grid in the picture ----------

  function onGrid() {
    return grid !== null && fields.useGrid.checked;
  }

  // The lowest and highest line numbers that are still inside the photo
  // (line 0 is the grid's first line; the lines carry on past the grid).
  function lineRange(lines, photoSize) {
    return {
      min: Math.ceil((-0.5 - lines.start) / lines.pitch),
      max: Math.floor((photoSize + 0.5 - lines.start) / lines.pitch),
    };
  }

  // Put the box on the grid lines in gridBox, and make the size match its squares.
  function applyGridBox() {
    const { c0, c1, r0, r1 } = gridBox;
    box = {
      x: grid.x.start + c0 * grid.x.pitch,
      y: grid.y.start + r0 * grid.y.pitch,
      w: (c1 - c0) * grid.x.pitch,
      h: (r1 - r0) * grid.y.pitch,
    };
    aspect = box.w / box.h;
    size = { cols: c1 - c0, rows: r1 - r0 };
    // Only change the boxes when they're different, so typing isn't interrupted.
    if (Number(fields.photoCols.value) !== size.cols) fields.photoCols.value = size.cols;
    if (Number(fields.photoRows.value) !== size.rows) fields.photoRows.value = size.rows;
    showSize();
    renderBox();
  }

  // The box around the whole grid that was found.
  function useWholeGrid() {
    gridBox = {
      c0: 0,
      c1: Math.min(grid.x.count, MAX_BEADS),
      r0: Math.max(0, grid.y.count - MAX_BEADS), // a very tall grid keeps its bottom rows
      r1: grid.y.count,
    };
    applyGridBox();
  }

  // Typing Columns or Rows on the grid: the box becomes that many squares,
  // keeping its bottom-left corner (where the work starts) if there's room.
  function changeGridSize(changed, value) {
    const { c0, r1 } = gridBox;
    if (changed === 'cols') {
      const { min, max } = lineRange(grid.x, photo.width);
      const right = Math.min(c0 + value, max);
      gridBox = { ...gridBox, c0: Math.max(min, right - value), c1: right };
    } else {
      const { min, max } = lineRange(grid.y, photo.height);
      const top = Math.max(min, r1 - value);
      gridBox = { ...gridBox, r0: top, r1: Math.min(max, top + value) };
    }
    applyGridBox();
    scheduleUpdate(true);
  }

  // Dragging on the grid: the box moves by whole squares, and a corner
  // drag moves those two edges to the nearest lines (any shape).
  function dragOnGrid(point) {
    const start = drag.startGridBox;
    const xs = lineRange(grid.x, photo.width);
    const ys = lineRange(grid.y, photo.height);
    const lineX = Math.round((point.x - grid.x.start) / grid.x.pitch);
    const lineY = Math.round((point.y - grid.y.start) / grid.y.pitch);
    let next;
    if (!drag.corner) {
      const dc = clamp(Math.round((point.x - drag.startPoint.x) / grid.x.pitch), xs.min - start.c0, xs.max - start.c1);
      const dr = clamp(Math.round((point.y - drag.startPoint.y) / grid.y.pitch), ys.min - start.r0, ys.max - start.r1);
      next = { c0: start.c0 + dc, c1: start.c1 + dc, r0: start.r0 + dr, r1: start.r1 + dr };
    } else {
      next = { ...start };
      if (drag.corner.includes('w')) next.c0 = clamp(lineX, Math.max(xs.min, start.c1 - MAX_BEADS), start.c1 - 1);
      else next.c1 = clamp(lineX, start.c0 + 1, Math.min(xs.max, start.c0 + MAX_BEADS));
      if (drag.corner.includes('n')) next.r0 = clamp(lineY, Math.max(ys.min, start.r1 - MAX_BEADS), start.r1 - 1);
      else next.r1 = clamp(lineY, start.r0 + 1, Math.min(ys.max, start.r0 + MAX_BEADS));
    }
    const changed = Object.keys(next).some((key) => next[key] !== gridBox[key]);
    if (!changed) return false;
    gridBox = next;
    applyGridBox();
    return true;
  }

  // The switch: on = back to the whole grid; off = a normal photo box with
  // the chart's shape, about the same size and place.
  function toggleGrid() {
    if (onGrid()) {
      useWholeGrid();
    } else {
      showSize(); // works out the chart's shape again
      reshapeBox();
    }
    showGridMode();
    scheduleUpdate(true);
  }

  // On the grid, the squares set the shape, so "Keep the box's shape" doesn't apply.
  function showGridMode() {
    fields.keepShape.disabled = onGrid();
    cropBox.classList.toggle('on-grid', onGrid());
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
    // On the grid, faint lines show the squares (one per bead).
    cropBox.style.backgroundSize = onGrid() ? `${grid.x.pitch * scale}px ${grid.y.pitch * scale}px` : '';
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
    drag = {
      corner: handle?.dataset.corner ?? null,
      startPoint: pointInPhoto(event),
      startBox: { ...box },
      startGridBox: gridBox && { ...gridBox },
    };
  });

  cropBox.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const point = pointInPhoto(event);
    if (onGrid()) {
      if (dragOnGrid(point) && !slow) scheduleUpdate(true);
      return;
    }
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
    if (event.target === fields.photoCols) return changeSize('cols');
    if (event.target === fields.photoRows) return changeSize('rows');
    if (event.target === fields.keepShape) return; // only matters when typing a size
    if (event.target === fields.useGrid) return toggleGrid();
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
      sampled = sampleBeadColors(photo, box, target(), { plainGrid: onGrid() });
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
      drawPreview(previewCanvas, { ...target(), beads: adjusted }, PREVIEW_MAX_WIDTH, maxHeight, (rgb) => rgb && rgbToHex(rgb));
    } else {
      drawPreview(previewCanvas, { ...target(), beads }, PREVIEW_MAX_WIDTH, maxHeight);
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
      `${size.cols} × ${size.rows} beads · ${chosen.length} colour${chosen.length === 1 ? '' : 's'}` +
      (empty > 0 ? ` · ${empty} empty (background)` : '');
  }

  // ---------- Apply / Cancel ----------

  dialog.querySelector('[data-action="apply"]').addEventListener('click', () => {
    onApply(beads, size);
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
