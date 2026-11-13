// The Select tool and the "Selection" buttons in the left panel.
//
// - Drag on the chart with Select to choose a rectangle of beads.
//   A click selects one bead; a click off the chart deselects.
// - Copy (⌘C / Ctrl+C) keeps a copy of the selected beads, ready to paste.
// - Fill paints the selection with the brush colour; Erase (Delete) empties it.
//   Each is one undo step.
// - Deselect (Esc).

import { rectBetween, rectSize, beadsIn, clampRect, copyBeads } from './selection.js';
import { drawSelection } from './grid.js';
import * as chart from './chart.js';

let clipboard = null; // the last copied beads: { rows, cols, beads }

// The copied beads, or null (used by paste).
export function getClipboard() {
  return clipboard;
}

// root: the left panel.
// chartView: from chart-view.js (to draw the outline on top of the chart).
// getBrushColorId(): the palette colour, or null.
// isActive(): true while the chart view is showing (for the keyboard shortcuts).
// afterChange(): the beads changed (redraw, update the undo buttons).
export function setupSelection(root, { chartView, getBrushColorId, isActive, afterChange }) {
  const buttons = {
    copy: root.querySelector('#selection-copy'),
    fill: root.querySelector('#selection-fill'),
    erase: root.querySelector('#selection-erase'),
    clear: root.querySelector('#selection-clear'),
  };
  const status = root.querySelector('#selection-status');

  let rect = null; // the selection (see selection.js), or null
  let dragStart = null; // the bead where the current drag began

  chartView.setOverlay((canvas, layout) => {
    if (rect) drawSelection(canvas, layout, rect);
  });

  function describe() {
    const { cols, rows } = rectSize(rect);
    const count = cols * rows;
    return `${cols} × ${rows} (${count} bead${count === 1 ? '' : 's'})`;
  }

  // Show the selection's size and which buttons can be used.
  function showState(message) {
    for (const button of Object.values(buttons)) button.disabled = !rect;
    if (message) status.textContent = message;
    else if (rect) status.textContent = `Selected: ${describe()}`;
    else status.textContent = 'Use Select to drag over some beads.';
  }

  function setRect(newRect, message) {
    rect = newRect;
    showState(message);
    chartView.repaint();
  }

  // ---------- Dragging (called by painting.js) ----------

  function onDrag(phase, bead) {
    if (phase === 'start') {
      dragStart = bead;
      setRect(bead ? rectBetween(bead, bead) : null); // off the chart: deselect
    } else if (phase === 'move' && bead) {
      if (!dragStart) dragStart = bead; // the drag started off the chart
      setRect(rectBetween(dragStart, bead));
    } else if (phase === 'end') {
      dragStart = null;
    }
  }

  // ---------- Actions ----------

  function copy() {
    if (!rect) return;
    clipboard = copyBeads(chart.getChart(), rect);
    showState(`Copied: ${describe()}`);
  }

  // Paint every selected bead with colorId (null = empty), as one undo step.
  function paintAll(colorId) {
    chart.beginStroke();
    for (const { row, col } of beadsIn(rect)) chart.paintBead(row, col, colorId);
    chart.endStroke();
    afterChange();
  }

  function fill() {
    if (!rect) return;
    const colorId = getBrushColorId();
    if (!colorId) {
      showState('Choose a colour in the palette first.');
      return;
    }
    paintAll(colorId);
  }

  function erase() {
    if (rect) paintAll(null);
  }

  function deselect() {
    if (rect) setRect(null);
  }

  buttons.copy.addEventListener('click', copy);
  buttons.fill.addEventListener('click', fill);
  buttons.erase.addEventListener('click', erase);
  buttons.clear.addEventListener('click', deselect);

  // ⌘C / Ctrl+C copy, Delete or Backspace erase, Esc deselect.
  // Not while typing in a box, so those keys still work there.
  window.addEventListener('keydown', (event) => {
    if (!rect || !isActive()) return;
    if (event.target.closest?.('input, textarea, select')) return;
    const command = event.metaKey || event.ctrlKey;
    if (command && event.key.toLowerCase() === 'c') copy();
    else if (!command && (event.key === 'Delete' || event.key === 'Backspace')) erase();
    else if (event.key === 'Escape') deselect();
    else return;
    event.preventDefault();
  });

  showState();

  return {
    onDrag,
    // The chart changed size or was swapped (undo, resize, another chart):
    // keep the part of the selection that still fits.
    fitTo(current) {
      if (!rect) return;
      rect = clampRect(rect, current);
      showState();
    },
    // Another chart was opened: start with nothing selected.
    clear() {
      rect = null;
      showState();
    },
  };
}
