// The Select tool and the "Selection" buttons in the left panel.
//
// - Drag on the chart with Select to choose a rectangle of beads.
//   A click selects one bead; a click off the chart deselects.
// - Copy (⌘C / Ctrl+C) keeps a copy of the selected beads.
// - Paste (⌘V / Ctrl+V) puts the copy over the chart as a floating piece.
//   Drag it into place, then Done (Enter, or click outside it). Cancel (Esc).
//   Empty beads in the piece are see-through. On brick and peyote the piece
//   only stops where its shape stays the same (see snapPosition in selection.js).
// - Fill paints the selection with the brush colour; Erase (Delete) empties it.
// - Deselect (Esc).
// Fill, Erase and each paste are one undo step.

import { rectBetween, rectSize, beadsIn, clampRect, copyBeads, shapeAt, snapPosition } from './selection.js';
import { drawSelection, drawPiece, topLeftBead, beadsMoved } from './grid.js';
import { getStitch } from './stitches/index.js';
import * as chart from './chart.js';

// The last copied beads: { rows, cols, beads, shape }. It stays when you open
// another chart, so you can paste into that one too.
let clipboard = null;

// root: the left panel. pasteBar: the "Drag to place / Cancel / Done" bar over the canvas.
// chartView: from chart-view.js (to draw on top of the chart).
// getBrushColorId(): the palette colour, or null.
// isActive(): true while the chart view is showing (for the keyboard shortcuts).
// afterChange(): the beads changed (redraw, update the undo buttons).
export function setupSelection(root, { pasteBar, chartView, getBrushColorId, isActive, afterChange }) {
  const buttons = {
    copy: root.querySelector('#selection-copy'),
    paste: root.querySelector('#selection-paste'),
    fill: root.querySelector('#selection-fill'),
    erase: root.querySelector('#selection-erase'),
    clear: root.querySelector('#selection-clear'),
  };
  const status = root.querySelector('#selection-status');

  let rect = null; // the selection (see selection.js), or null
  let dragStart = null; // the bead where the current selection drag began
  // A pasted piece that hasn't been dropped yet:
  // { piece, at: { row, col } (its top-left bead),
  //   grab: { point, at } where a drag picked it up and where the piece was then, or null }
  let floating = null;

  // The rectangle a floating piece covers.
  function pieceRect() {
    const { at, piece } = floating;
    return { top: at.row, left: at.col, bottom: at.row + piece.rows - 1, right: at.col + piece.cols - 1 };
  }

  chartView.setOverlay((canvas, layout) => {
    if (floating) {
      drawPiece(canvas, layout, floating.piece, floating.at);
      const visible = clampRect(pieceRect(), layout);
      if (visible) drawSelection(canvas, layout, visible, { tint: false });
    } else if (rect) {
      drawSelection(canvas, layout, rect);
    }
  });

  function describe(size) {
    const count = size.cols * size.rows;
    return `${size.cols} × ${size.rows} (${count} bead${count === 1 ? '' : 's'})`;
  }

  // Show the selection's size and which buttons can be used.
  function showState(message) {
    const canEdit = Boolean(rect) && !floating;
    buttons.copy.disabled = !canEdit;
    buttons.fill.disabled = !canEdit;
    buttons.erase.disabled = !canEdit;
    buttons.clear.disabled = !canEdit;
    buttons.paste.disabled = !clipboard || Boolean(floating);
    pasteBar.hidden = !floating;
    if (message) status.textContent = message;
    else if (floating) status.textContent = 'Pasting…';
    else if (rect) status.textContent = `Selected: ${describe(rectSize(rect))}`;
    else status.textContent = 'Use Select to drag over some beads.';
  }

  function setRect(newRect, message) {
    rect = newRect;
    showState(message);
    chartView.repaint();
  }

  // ---------- Dragging on the chart (called by painting.js) ----------

  function onDrag(phase, bead, point) {
    if (floating) dragPiece(phase, bead, point);
    else dragSelection(phase, bead);
  }

  function dragSelection(phase, bead) {
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

  // The piece moves by how far the pointer has moved (in whole beads), not by
  // which bead is under it: on brick and peyote the bead under the pointer
  // jumps between columns (or rows) as you cross the half-bead shifts.
  function dragPiece(phase, bead, point) {
    if (phase === 'start') {
      const r = pieceRect();
      const onPiece = bead && bead.row >= r.top && bead.row <= r.bottom && bead.col >= r.left && bead.col <= r.right;
      if (onPiece) floating.grab = { point, at: floating.at };
      else commitPaste(); // a click outside the piece drops it
    } else if (phase === 'move' && floating?.grab) {
      const { grab } = floating;
      const moved = beadsMoved(chartView.getLayout(), grab.point, point);
      const wanted = { row: grab.at.row + moved.rows, col: grab.at.col + moved.cols };
      const current = chart.getChart();
      const at = snapPosition(getStitch(current.stitch), current, floating.piece, wanted);
      if (at.row !== floating.at.row || at.col !== floating.at.col) {
        floating.at = at;
        chartView.repaint();
      }
    } else if (phase === 'end' && floating) {
      floating.grab = null;
    }
  }

  // ---------- Actions ----------

  function copy() {
    if (!rect || floating) return;
    const current = chart.getChart();
    const { rows, cols } = rectSize(rect);
    clipboard = {
      ...copyBeads(current, rect),
      shape: shapeAt(getStitch(current.stitch), current, rect.top, rect.left, rows, cols),
    };
    showState(`Copied: ${describe(clipboard)}`);
  }

  function paste() {
    if (!clipboard || floating) return;
    // The piece's top-left corner, as you see it, goes at the top-left corner
    // of the selection if there is one, otherwise of the screen.
    // Turned sideways, the top left on screen is the selection's bottom row
    // (row 1 is on the left), and the piece's rows run to the right of it,
    // so the piece's first row in the chart is further up.
    const layout = chartView.getLayout();
    let corner;
    if (rect) corner = layout.rotated ? { row: rect.bottom, col: rect.left } : { row: rect.top, col: rect.left };
    else corner = topLeftBead(layout);
    const wanted = layout.rotated ? { row: corner.row - clipboard.rows + 1, col: corner.col } : corner;
    const current = chart.getChart();
    floating = { piece: clipboard, at: snapPosition(getStitch(current.stitch), current, clipboard, wanted), grab: null };
    rect = null;
    showState();
    chartView.repaint();
  }

  // Drop the floating piece into the chart (one undo step). It stays selected,
  // so you can fill, erase or copy it straight away.
  function commitPaste() {
    if (!floating) return;
    const current = chart.getChart();
    const { piece, at } = floating;
    chart.beginStroke();
    piece.beads.forEach((beadRow, r) => {
      beadRow.forEach((colorId, c) => {
        const row = at.row + r;
        const col = at.col + c;
        const inChart = row >= 0 && row < current.rows && col >= 0 && col < current.cols;
        if (colorId !== null && inChart) chart.paintBead(row, col, colorId); // empty = see-through
      });
    });
    chart.endStroke();
    rect = clampRect(pieceRect(), current);
    floating = null;
    showState();
    afterChange();
  }

  // Throw the floating piece away. Returns true if there was one.
  function cancelPaste() {
    if (!floating) return false;
    floating = null;
    showState();
    chartView.repaint();
    return true;
  }

  // Paint every selected bead with colorId (null = empty), as one undo step.
  function paintAll(colorId) {
    chart.beginStroke();
    for (const { row, col } of beadsIn(rect)) chart.paintBead(row, col, colorId);
    chart.endStroke();
    afterChange();
  }

  function fill() {
    if (!rect || floating) return;
    const colorId = getBrushColorId();
    if (!colorId) {
      showState('Choose a colour in the palette first.');
      return;
    }
    paintAll(colorId);
  }

  function erase() {
    if (rect && !floating) paintAll(null);
  }

  function deselect() {
    if (rect) setRect(null);
  }

  buttons.copy.addEventListener('click', copy);
  buttons.paste.addEventListener('click', paste);
  buttons.fill.addEventListener('click', fill);
  buttons.erase.addEventListener('click', erase);
  buttons.clear.addEventListener('click', deselect);
  pasteBar.querySelector('[data-action="cancel"]').addEventListener('click', cancelPaste);
  pasteBar.querySelector('[data-action="done"]').addEventListener('click', commitPaste);

  // Keyboard: ⌘C copy, ⌘V paste, Delete/Backspace erase, Esc deselect.
  // While pasting: Enter drops the piece, Esc cancels.
  // Not while typing in a box, so those keys still work there.
  window.addEventListener('keydown', (event) => {
    if (!isActive() || event.target.closest?.('input, textarea, select')) return;
    const command = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (floating) {
      if (key === 'enter') commitPaste();
      else if (key === 'escape') cancelPaste();
      else return;
    } else if (command && key === 'v' && clipboard) paste();
    else if (rect && command && key === 'c') copy();
    else if (rect && !command && (key === 'delete' || key === 'backspace')) erase();
    else if (rect && key === 'escape') deselect();
    else return;
    event.preventDefault();
  });

  showState();

  return {
    onDrag,
    // True while a pasted piece is floating: then every drag on the chart moves it.
    isPasting: () => Boolean(floating),
    cancelPaste,
    // The chart changed size or was swapped (undo, resize, another chart):
    // keep the part of the selection that still fits.
    fitTo(current) {
      if (!rect) return;
      rect = clampRect(rect, current);
      showState();
    },
    // Another chart was opened: nothing selected, nothing floating.
    clear() {
      rect = null;
      floating = null;
      showState();
    },
  };
}
