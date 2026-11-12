// "Pick from photo": load a photo of my beads, zoom in, click or drag over a
// small area, and use the average colour of that area.
// The photo is kept until the page is reloaded, so I can pick several colours
// from one photo of many bead tubes.

import { preparePhoto } from './photo-sampling.js';
import { rgbToHex } from './color-math.js';

const ZOOM_STEP = 1.5;
const MAX_ZOOM = 16; // 16 screen pixels per photo pixel
const CLICK_AREA = 7; // a click (no drag) uses a 7 × 7 pixel square

export function setupPhotoColorPicker() {
  const dialog = document.querySelector('#pick-color-dialog');
  const fileInput = dialog.querySelector('input[type="file"]');
  const viewport = dialog.querySelector('.pick-viewport');
  const stage = dialog.querySelector('.pick-stage');
  const selectionBox = dialog.querySelector('.pick-selection');
  const zoomLabel = dialog.querySelector('.pick-zoom-label');
  const currentSwatch = dialog.querySelector('.pick-current');
  const pickedSwatch = dialog.querySelector('.pick-picked');
  const pickedHex = dialog.querySelector('.pick-hex');
  const useButton = dialog.querySelector('[data-action="use"]');

  let photo = null; // the photo, as a canvas
  let zoom = 1; // screen pixels per photo pixel
  let selection = null; // { x, y, w, h } in photo pixels
  let picked = null; // the picked colour, e.g. "#a83242"
  let onPick = null; // what to do with the colour when I click "Use this colour"

  // ---------- Opening ----------

  // currentHex: the colour now, to compare with. onPickColor(hex): called on "Use this colour".
  function open({ currentHex, onPickColor }) {
    onPick = onPickColor;
    currentSwatch.style.background = currentHex;
    if (photo) show();
    else fileInput.click(); // first time: choose a photo
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = ''; // so picking the same file again still works
    if (!file) return;
    const image = new Image();
    const url = URL.createObjectURL(file);
    try {
      image.src = url;
      await image.decode();
      photo = preparePhoto(image);
    } catch {
      alert("Couldn't open this image. Try a JPEG or PNG.");
      return;
    } finally {
      URL.revokeObjectURL(url);
    }
    show();
  });

  function show() {
    stage.querySelector('canvas')?.remove();
    stage.prepend(photo);
    selection = null;
    picked = null;
    if (!dialog.open) dialog.showModal();
    fit();
    showPicked();
  }

  dialog.querySelector('[data-action="choose-photo"]').addEventListener('click', () => fileInput.click());

  // ---------- Zoom ----------

  function fitZoom() {
    return Math.min(viewport.clientWidth / photo.width, (window.innerHeight * 0.5) / photo.height);
  }

  // Zoom, keeping the photo point under `anchor` (pixels in the scroll box) in place.
  function setZoom(newZoom, anchor = { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 }) {
    const photoX = (viewport.scrollLeft + anchor.x) / zoom;
    const photoY = (viewport.scrollTop + anchor.y) / zoom;
    zoom = Math.min(Math.max(newZoom, Math.min(fitZoom(), 1)), MAX_ZOOM);
    photo.style.width = `${photo.width * zoom}px`;
    photo.style.height = `${photo.height * zoom}px`;
    // Zoomed right in, show the real pixels as squares instead of blurring them.
    photo.style.imageRendering = zoom > 2 ? 'pixelated' : 'auto';
    viewport.scrollLeft = photoX * zoom - anchor.x;
    viewport.scrollTop = photoY * zoom - anchor.y;
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    showSelection();
  }

  function fit() {
    zoom = fitZoom();
    setZoom(zoom);
    viewport.scrollTo(0, 0);
  }

  dialog.querySelector('[data-action="zoom-in"]').addEventListener('click', () => setZoom(zoom * ZOOM_STEP));
  dialog.querySelector('[data-action="zoom-out"]').addEventListener('click', () => setZoom(zoom / ZOOM_STEP));
  dialog.querySelector('[data-action="fit"]').addEventListener('click', fit);

  // Cmd + scroll, or a trackpad pinch, zooms around the pointer.
  viewport.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const delta = Math.min(Math.max(event.deltaY, -25), 25);
      setZoom(zoom * Math.exp(-delta * 0.01), { x: event.clientX - rect.left, y: event.clientY - rect.top });
    },
    { passive: false },
  );

  // ---------- Choosing an area ----------

  // Pointer position in photo pixels.
  function pointInPhoto(event) {
    const rect = photo.getBoundingClientRect();
    return {
      x: Math.min(Math.max((event.clientX - rect.left) / zoom, 0), photo.width),
      y: Math.min(Math.max((event.clientY - rect.top) / zoom, 0), photo.height),
    };
  }

  let dragStart = null;

  stage.addEventListener('pointerdown', (event) => {
    if (event.target !== photo) return;
    event.preventDefault();
    stage.setPointerCapture(event.pointerId);
    dragStart = pointInPhoto(event);
    selection = { x: dragStart.x, y: dragStart.y, w: 0, h: 0 };
    showSelection();
  });

  stage.addEventListener('pointermove', (event) => {
    if (!dragStart) return;
    const point = pointInPhoto(event);
    selection = {
      x: Math.min(dragStart.x, point.x),
      y: Math.min(dragStart.y, point.y),
      w: Math.abs(point.x - dragStart.x),
      h: Math.abs(point.y - dragStart.y),
    };
    showSelection();
  });

  function endDrag() {
    if (!dragStart) return;
    // A click (or a tiny drag) uses a small square around the point.
    if (selection.w < 2 && selection.h < 2) {
      selection = { x: dragStart.x - CLICK_AREA / 2, y: dragStart.y - CLICK_AREA / 2, w: CLICK_AREA, h: CLICK_AREA };
    }
    dragStart = null;
    picked = averageColor(selection);
    showSelection();
    showPicked();
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  // The average colour of an area of the photo.
  function averageColor(area) {
    const x = Math.max(0, Math.floor(area.x));
    const y = Math.max(0, Math.floor(area.y));
    const w = Math.max(1, Math.min(photo.width - x, Math.ceil(area.w)));
    const h = Math.max(1, Math.min(photo.height - y, Math.ceil(area.h)));
    const data = photo.getContext('2d', { willReadFrequently: true }).getImageData(x, y, w, h).data;
    const sum = [0, 0, 0];
    for (let i = 0; i < data.length; i += 4) {
      sum[0] += data[i];
      sum[1] += data[i + 1];
      sum[2] += data[i + 2];
    }
    const count = data.length / 4;
    return rgbToHex(sum.map((total) => Math.round(total / count)));
  }

  function showSelection() {
    selectionBox.hidden = !selection;
    if (!selection) return;
    selectionBox.style.left = `${selection.x * zoom}px`;
    selectionBox.style.top = `${selection.y * zoom}px`;
    selectionBox.style.width = `${Math.max(selection.w * zoom, 2)}px`;
    selectionBox.style.height = `${Math.max(selection.h * zoom, 2)}px`;
  }

  function showPicked() {
    pickedSwatch.style.background = picked ?? 'transparent';
    pickedSwatch.classList.toggle('is-empty', !picked);
    pickedHex.textContent = picked ?? 'Nothing picked yet';
    useButton.disabled = !picked;
  }

  // ---------- Use / Cancel ----------

  useButton.addEventListener('click', () => {
    onPick(picked);
    dialog.close();
  });
  dialog.querySelector('[data-action="cancel"]').addEventListener('click', () => dialog.close());

  return { open };
}
