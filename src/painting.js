// Mouse/touch painting on the canvas: click one bead, or drag across many.

import { beginStroke, paintBead, endStroke, getChart } from './chart.js';
import { beadAtPoint, drawBead } from './grid.js';

// getLayout()  → the layout from the last drawGrid()
// getColorId() → the selected colour id, or null for the eraser
// onStrokeEnd() → called when a drag finishes (to update the undo buttons)
export function setupPainting(canvas, { getLayout, getColorId, onStrokeEnd }) {
  let lastPoint = null; // where the pointer was last time, while dragging

  // Pointer position in CSS pixels, relative to the canvas's top left.
  function pointFrom(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function paintAt({ x, y }) {
    const layout = getLayout();
    const hit = beadAtPoint(layout, x, y);
    if (!hit) return;
    const colorId = getColorId();
    if (paintBead(hit.row, hit.col, colorId)) {
      drawBead(canvas, layout, hit.row, hit.col, colorId); // only redraw that one bead
    }
  }

  // A fast drag can jump over beads between two mouse events,
  // so we also paint the points in between, in small steps.
  function paintLine(from, to) {
    const layout = getLayout();
    const step = Math.min(layout.beadW, layout.beadH) / 3;
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(distance / step));
    for (let i = 1; i <= steps; i++) {
      paintAt({
        x: from.x + ((to.x - from.x) * i) / steps,
        y: from.y + ((to.y - from.y) * i) / steps,
      });
    }
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !getChart()) return; // left button only
    // "Capture" keeps sending us moves even if the pointer leaves the canvas.
    canvas.setPointerCapture(event.pointerId);
    beginStroke();
    lastPoint = pointFrom(event);
    paintAt(lastPoint);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!lastPoint) return; // not dragging
    const point = pointFrom(event);
    paintLine(lastPoint, point);
    lastPoint = point;
  });

  function finish() {
    if (!lastPoint) return;
    lastPoint = null;
    endStroke();
    onStrokeEnd();
  }
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
}
