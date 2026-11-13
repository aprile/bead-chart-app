// How the chart is viewed: zoom, scrolling, grid lines and row/column numbers.
// The settings are remembered between visits.
//
// How scrolling works: a big empty "spacer" the size of the whole chart sits
// inside a scrolling box, so you get normal scrollbars. The canvas sticks to
// the visible part of the box, and we redraw the beads that are in view.

import { autoScale, fitScale, makeLayout, drawChart, chartSizeMm } from './grid.js';
import { getStitch } from './stitches/index.js';
import { load, save, STORAGE_KEYS } from './storage.js';

const ZOOM_STEP = 1.25; // each + or − button press
const MIN_BEAD_PX = 3; // smallest/biggest bead when zooming (shorter side)
const MAX_BEAD_PX = 160;
const NUMBERS_SPACE = { left: 36, bottom: 22 }; // room for row numbers (left) and column numbers (bottom)
const EDGE_SPACE = 16; // space around the chart when it fits in the box

// Saved shape: { zoom: null | "fit" | pixels per mm, gridLines: false, numbers: false }
// zoom null = the starting size; "fit" = always fit the whole chart.
function loadView() {
  const saved = load(STORAGE_KEYS.view);
  const zoom = saved?.zoom;
  return {
    zoom: zoom === 'fit' || (typeof zoom === 'number' && zoom > 0) ? zoom : null,
    gridLines: saved?.gridLines ?? false,
    numbers: saved?.numbers ?? false,
  };
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// elements = { viewport, spacer, canvas, zoomIn, zoomOut, fit, zoomLabel, gridLines, numbers }
export function setupChartView(elements) {
  const { viewport, spacer, canvas } = elements;
  const view = loadView();
  let chart = null;
  let scale = 1; // pixels per mm right now
  let content = { width: 0, height: 0 };
  let layout = null;
  let overlay = null; // see setOverlay() below

  function saveView() {
    save(STORAGE_KEYS.view, view);
  }

  function margins() {
    return view.numbers ? NUMBERS_SPACE : { left: 0, bottom: 0 };
  }

  // Room for the chart: the scrolling box, which fills the space between the
  // panels, minus the numbers and a little space around the edge.
  function available() {
    const m = margins();
    return {
      width: Math.max(50, viewport.offsetWidth - m.left - 2 * EDGE_SPACE),
      height: Math.max(50, viewport.offsetHeight - 2 * EDGE_SPACE),
    };
  }

  // Keep zoom within sensible bead sizes for this chart.
  function clampScale(value) {
    const { smallerMm } = chartSizeMm(chart);
    return clamp(value, MIN_BEAD_PX / smallerMm, MAX_BEAD_PX / smallerMm);
  }

  function chooseScale() {
    const { width, height } = available();
    const space = height - margins().bottom;
    if (view.zoom === 'fit') return fitScale(chart, width, space);
    if (typeof view.zoom === 'number') return clampScale(view.zoom);
    return autoScale(chart, width, space);
  }

  // Work out sizes, then draw. Call when the chart, window or zoom changes.
  function render(newChart = chart) {
    chart = newChart;
    // Nothing to draw, or the chart screen is hidden (the box has no size).
    if (!chart || viewport.offsetWidth === 0) return;
    scale = chooseScale();
    const size = chartSizeMm(chart);
    const m = margins();
    content = { width: size.widthMm * scale + m.left, height: size.heightMm * scale + m.bottom };
    spacer.style.width = `${content.width}px`;
    spacer.style.height = `${content.height}px`;
    paint();
    updateControls();
  }

  // Draw what's visible (also called on every scroll).
  function paint() {
    if (!chart) return;
    const m = margins();
    layout = makeLayout(chart, scale, {
      originX: m.left - viewport.scrollLeft,
      originY: -viewport.scrollTop,
      clipX: m.left,
      clipBottom: m.bottom,
      gridLines: view.gridLines,
      numbers: view.numbers,
    });
    const width = Math.min(viewport.clientWidth, content.width);
    const height = Math.min(viewport.clientHeight, content.height);
    drawChart(canvas, chart, layout, width, height);
    overlay?.(canvas, layout); // e.g. the selection outline, on top of the beads
  }

  function updateControls() {
    const { width, height } = available();
    const percent = Math.round((scale / autoScale(chart, width, height - margins().bottom)) * 100);
    elements.zoomLabel.textContent = `${percent}%`;
    // Only some stitches have grid lines (the stitch module says which).
    const stitch = getStitch(chart.stitch);
    elements.gridLines.disabled = !stitch.gridLines;
    elements.gridLines.checked = view.gridLines && stitch.gridLines;
    elements.gridLines.parentElement.title = stitch.gridLines ? '' : `These lines aren't available for ${stitch.label.toLowerCase()}`;
    elements.numbers.checked = view.numbers;
    elements.fit.setAttribute('aria-pressed', view.zoom === 'fit');
  }

  // Zoom, keeping the bead under `anchor` (canvas pixels) in the same place.
  function zoomTo(newScale, anchor = { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 }) {
    const m = margins();
    // Which spot of the chart (in mm) is under the anchor now?
    const mmX = (anchor.x + viewport.scrollLeft - m.left) / scale;
    const mmY = (anchor.y + viewport.scrollTop) / scale;
    view.zoom = clampScale(newScale);
    saveView();
    render();
    // Scroll so that same spot is under the anchor again.
    viewport.scrollLeft = mmX * scale + m.left - anchor.x;
    viewport.scrollTop = mmY * scale - anchor.y;
    paint();
  }

  // Pointer position relative to the canvas.
  function anchorFrom(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  // ---------- Controls ----------

  elements.zoomIn.addEventListener('click', () => zoomTo(scale * ZOOM_STEP));
  elements.zoomOut.addEventListener('click', () => zoomTo(scale / ZOOM_STEP));
  elements.fit.addEventListener('click', () => {
    view.zoom = 'fit';
    saveView();
    viewport.scrollTo(0, 0);
    render();
  });
  elements.gridLines.addEventListener('change', () => {
    view.gridLines = elements.gridLines.checked;
    saveView();
    paint();
  });
  elements.numbers.addEventListener('change', () => {
    view.numbers = elements.numbers.checked;
    saveView();
    render();
  });

  viewport.addEventListener('scroll', paint);

  // Redraw when the box changes size: the window is resized, or a side
  // panel is shown or hidden.
  new ResizeObserver(() => render()).observe(viewport);

  // Cmd + scroll wheel, or a trackpad pinch (Chrome and Firefox send a pinch
  // as a wheel event with Ctrl held down).
  viewport.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey && !event.metaKey) return; // plain scrolling: let it scroll
      event.preventDefault(); // stop the browser zooming the whole page
      const delta = clamp(event.deltaY, -25, 25); // one mouse-wheel click ≈ 25% zoom
      zoomTo(scale * Math.exp(-delta * 0.01), anchorFrom(event));
    },
    { passive: false }, // needed so preventDefault() is allowed
  );

  // Safari sends trackpad pinches as "gesture" events instead.
  let gestureStartScale = null;
  viewport.addEventListener('gesturestart', (event) => {
    event.preventDefault();
    gestureStartScale = scale;
  });
  viewport.addEventListener('gesturechange', (event) => {
    event.preventDefault();
    if (gestureStartScale) zoomTo(gestureStartScale * event.scale, anchorFrom(event));
  });
  viewport.addEventListener('gestureend', () => (gestureStartScale = null));

  return {
    render,
    // Redraw without re-measuring (e.g. while dragging out a selection).
    repaint: paint,
    // fn(canvas, layout) draws extra things on top of the chart after every redraw.
    setOverlay(fn) {
      overlay = fn;
    },
    getLayout: () => layout,
    scrollToStart() {
      viewport.scrollTo(0, 0);
    },
  };
}
