import './style.css';
import { setupNewChartPanel } from './new-chart-panel.js';
import { setupPalette } from './palette.js';
import { setupPainting } from './painting.js';
import { drawGrid } from './grid.js';
import * as chart from './chart.js';

const canvas = document.querySelector('#chart-canvas');
const undoButton = document.querySelector('#undo-button');
const redoButton = document.querySelector('#redo-button');
const clearButton = document.querySelector('#clear-button');

let layout = null; // bead sizes in pixels, from the last full drawing

function redraw() {
  layout = drawGrid(canvas, chart.getChart());
  updateButtons();
}

function updateButtons() {
  undoButton.disabled = !chart.canUndo();
  redoButton.disabled = !chart.canRedo();
}

const panel = setupNewChartPanel(document.querySelector('#new-chart-form'), {
  onChange(settings) {
    chart.resizeChart(settings);
    redraw();
  },
  onEditEnd() {
    chart.endResize();
    updateButtons();
  },
});

const palette = setupPalette(document.querySelector('#palette'));

setupPainting(canvas, {
  getLayout: () => layout,
  getColorId: () => palette.getSelectedColorId(),
  onStrokeEnd: updateButtons,
});

// Undo/redo can change the size too, so the form is updated to match.
function undo() {
  if (chart.undo()) {
    panel.showChart(chart.getChart());
    redraw();
  }
}

function redo() {
  if (chart.redo()) {
    panel.showChart(chart.getChart());
    redraw();
  }
}

undoButton.addEventListener('click', undo);
redoButton.addEventListener('click', redo);

clearButton.addEventListener('click', () => {
  if (chart.isEmpty()) return;
  if (confirm('Clear all beads from the chart? (You can undo this.)')) {
    chart.clearChart();
    redraw();
  }
});

// Cmd+Z = undo, Shift+Cmd+Z = redo (Ctrl on Windows/Linux).
window.addEventListener('keydown', (event) => {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
  // In the width/height boxes, let Cmd+Z undo your typing as normal.
  if (event.target.matches('input[type="number"], input[type="text"], textarea')) return;
  event.preventDefault();
  if (event.shiftKey) redo();
  else undo();
});

// Resizing the window (or moving it to another screen) changes the space available.
window.addEventListener('resize', redraw);

// Start with an empty chart sized from the form's starting values.
chart.newChart(panel.readSettings());
redraw();
