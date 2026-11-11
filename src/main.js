import './style.css';
import { setupNewChartPanel } from './new-chart-panel.js';
import { setupPalette } from './palette.js';
import { setupPainting } from './painting.js';
import { setupStashScreen } from './stash-screen.js';
import { setupChartsScreen } from './charts-screen.js';
import { setupViews } from './views.js';
import { setupPhotoImport } from './photo.js';
import { setupChartView } from './chart-view.js';
import { countMissingBeads } from './colors.js';
import { loadSavedChart, listSavedCharts, getCurrentChartId, setCurrentChartId } from './storage.js';
import { setupAutosave, saveCurrentChart, flushSave } from './autosave.js';
import * as chart from './chart.js';

const canvas = document.querySelector('#chart-canvas');
const undoButton = document.querySelector('#undo-button');
const redoButton = document.querySelector('#redo-button');
const clearButton = document.querySelector('#clear-button');
const nameInput = document.querySelector('#chart-name');
const saveStatus = document.querySelector('#save-status');
const missingNote = document.querySelector('#missing-note');

// Zoom, scrolling, grid lines and numbers.
const chartView = setupChartView({
  viewport: document.querySelector('#grid-viewport'),
  spacer: document.querySelector('#grid-spacer'),
  canvas,
  toolbar: document.querySelector('.toolbar'),
  zoomIn: document.querySelector('#zoom-in'),
  zoomOut: document.querySelector('#zoom-out'),
  fit: document.querySelector('#zoom-fit'),
  zoomLabel: document.querySelector('#zoom-label'),
  gridLines: document.querySelector('#show-grid-lines'),
  numbers: document.querySelector('#show-numbers'),
});

let views = null; // set up at the bottom, once the chart exists

function redraw() {
  // Only draw while the chart view is showing (a hidden canvas has no size).
  // Switching to the chart view calls redraw() again.
  if (!views || !views.isShowing('chart')) return;
  const current = chart.getChart();
  chartView.render(current);
  palette.show(current.beadSize); // the bead size or stash may have changed
  updateButtons();
  updateMissingNote();
}

function updateButtons() {
  undoButton.disabled = !chart.canUndo();
  redoButton.disabled = !chart.canRedo();
}

function updateMissingNote() {
  const count = countMissingBeads(chart.getChart().beads);
  missingNote.hidden = count === 0;
  const what = count === 1 ? '1 bead uses a colour' : `${count} beads use colours`;
  missingNote.textContent =
    `${what} that no longer exist. They're shown white with a red ×: paint over them with another colour.`;
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
  getLayout: () => chartView.getLayout(),
  getColorId: () => palette.getSelectedColorId(),
  onStrokeEnd() {
    updateButtons();
    updateMissingNote(); // painting over a missing bead fixes it
  },
});

// ---------- Opening, creating and naming charts ----------

// Show the open chart in the form, the name box and the grid.
function showOpenChart() {
  const current = chart.getChart();
  panel.showChart(current);
  nameInput.value = current.name;
  chartView.scrollToStart(); // a different chart starts at the top left
  redraw();
}

function openSavedChart(saved) {
  flushSave(); // finish saving the chart we're leaving
  chart.openChart(saved);
  setCurrentChartId(saved.id);
  showOpenChart();
}

function startNewChart() {
  flushSave();
  // Use the size in the form. If it isn't valid right now, copy the open chart's size.
  const settings = panel.readSettings() ?? chart.getChart();
  chart.newChart(settings);
  saveCurrentChart();
  showOpenChart();
}

document.querySelector('#new-chart-button').addEventListener('click', () => {
  startNewChart();
  nameInput.focus();
  nameInput.select(); // ready to type a name
});

nameInput.addEventListener('input', () => chart.renameChart(nameInput.value));
nameInput.addEventListener('change', () => {
  // An empty name goes back to "Untitled chart" when you leave the box.
  if (!nameInput.value.trim()) {
    nameInput.value = chart.DEFAULT_NAME;
    chart.renameChart(chart.DEFAULT_NAME);
  }
});

// ---------- Undo, redo, clear ----------

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

setupPhotoImport({
  button: document.querySelector('#photo-button'),
  fileInput: document.querySelector('#photo-file'),
  getChart: chart.getChart,
  onApply(beads) {
    chart.setAllBeads(beads);
    redraw();
  },
});

// Cmd+Z = undo, Shift+Cmd+Z = redo (Ctrl on Windows/Linux).
window.addEventListener('keydown', (event) => {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
  if (!views.isShowing('chart')) return;
  // In text boxes, let Cmd+Z undo your typing as normal.
  if (event.target.matches('input[type="number"], input[type="text"], input[type="search"], textarea')) return;
  event.preventDefault();
  if (event.shiftKey) redo();
  else undo();
});

// Resizing the window (or moving it to another screen) changes the space available.
window.addEventListener('resize', redraw);

// ---------- Saving ----------

setupAutosave((state) => {
  saveStatus.textContent = {
    saving: 'Saving…',
    saved: 'Saved',
    error: "Couldn't save: the browser's storage is full. Export a backup, then delete some charts.",
  }[state];
  saveStatus.classList.toggle('error', state === 'error');
});

// ---------- Other screens ----------

setupStashScreen(document.querySelector('#stash-view'));

const chartsScreen = setupChartsScreen(document.querySelector('#charts-view'), {
  getOpenChartId: () => chart.getChart().id,
  openChart: openSavedChart,
  renameOpenChart(name) {
    chart.renameChart(name);
    nameInput.value = name;
    saveCurrentChart();
  },
  afterDeleteOpenChart() {
    // Open the most recently changed chart that's left, or start a new one.
    const next = listSavedCharts()[0];
    if (next) {
      chart.openChart(next);
      setCurrentChartId(next.id);
      showOpenChart();
    } else {
      startNewChart();
    }
  },
  newChart: startNewChart,
});

// ---------- Start up ----------

// Reopen the chart I was last working on (or the most recent one, or a new one).
const lastChart = loadSavedChart(getCurrentChartId()) ?? listSavedCharts()[0];
if (lastChart) {
  chart.openChart(lastChart);
  setCurrentChartId(lastChart.id);
  showOpenChart();
} else {
  startNewChart();
}

// Shows the right view now, and again whenever you switch.
views = setupViews((name) => {
  if (name === 'chart') redraw(); // also picks up stash changes in the palette
  if (name === 'charts') chartsScreen.render();
});
