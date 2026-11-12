import './app.css';
// Basecoat's scripts for the interactive components (the panel tabs).
import 'basecoat-css/basecoat';
import 'basecoat-css/tabs';
import { setupDarkMode } from './dark-mode.js';
import { showIcons } from './icons.js';
import { setupPanels } from './panels.js';
import { setupTools } from './tools.js';
import { joinedArea } from './fill.js';
import { setupNewChartPanel } from './new-chart-panel.js';
import { setupPalette } from './palette.js';
import { setupPainting } from './painting.js';
import { setupStashScreen } from './stash-screen.js';
import { setupChartsScreen } from './charts-screen.js';
import { setupViews } from './views.js';
import { setupPhotoImport } from './photo.js';
import { setupCalibrationScreen } from './calibration-screen.js';
import { setupChartView } from './chart-view.js';
import { countMissingBeads, getColor, colorLabel } from './colors.js';
import { loadSavedChart, listSavedCharts, getCurrentChartId, setCurrentChartId } from './storage.js';
import { setupAutosave, saveCurrentChart, flushSave } from './autosave.js';
import * as chart from './chart.js';

showIcons();
// The canvas colours (numbers, background) follow dark mode, but need a redraw.
setupDarkMode(() => redraw());
setupPanels({
  left: { panel: document.querySelector('#left-panel'), button: document.querySelector('#toggle-left-panel') },
  right: { panel: document.querySelector('#right-panel'), button: document.querySelector('#toggle-right-panel') },
});

const canvas = document.querySelector('#chart-canvas');
const undoButton = document.querySelector('#undo-button');
const redoButton = document.querySelector('#redo-button');
const clearButton = document.querySelector('#clear-button');
const nameInput = document.querySelector('#chart-name');
const saveStatus = document.querySelector('#save-status');
const missingNote = document.querySelector('#missing-note');
const missingText = document.querySelector('#missing-text');

// Zoom, scrolling, grid lines and numbers.
const chartView = setupChartView({
  viewport: document.querySelector('#grid-viewport'),
  spacer: document.querySelector('#grid-spacer'),
  canvas,
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
  missingText.textContent =
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

// Brush and eraser (left panel). The brush uses the colour chosen in the palette.
const tools = setupTools(document.querySelector('#left-panel'));

const palette = setupPalette(document.querySelector('#palette'), {
  onSelect: (colorId) => tools.showColor(colorId),
  onPick: () => tools.setTool('brush'), // clicking a colour switches back to the brush
});

setupPainting(canvas, {
  getLayout: () => chartView.getLayout(),
  // null = erase; undefined = nothing to paint with (no colour in the palette)
  getColorId() {
    if (tools.getTool() === 'eraser') return null;
    return palette.getSelectedColorId() ?? undefined;
  },
  getTool: () => tools.getTool(),
  onBeadClick(tool, { row, col }) {
    if (tool === 'fill') fillFrom(row, col);
    else pickFrom(row, col);
  },
  onStrokeEnd() {
    updateButtons();
    updateMissingNote(); // painting over a missing bead fixes it
  },
});

// Fill: paint every joined bead of the same colour with the brush colour.
// It's one undo step, like a brush stroke.
function fillFrom(row, col) {
  const colorId = palette.getSelectedColorId();
  if (!colorId) return; // no colour to fill with
  chart.beginStroke();
  for (const bead of joinedArea(chart.getChart(), row, col)) chart.paintBead(bead.row, bead.col, colorId);
  chart.endStroke();
  redraw();
}

// Picker: use a bead's colour, then switch to the brush (or the eraser for an empty bead).
function pickFrom(row, col) {
  const colorId = chart.getChart().beads[row][col];
  if (colorId === null) {
    tools.setTool('eraser');
  } else if (palette.select(colorId)) {
    tools.setTool('brush');
  } else {
    const color = getColor(colorId);
    tools.showMessage(color ? `Not in your stash: ${colorLabel(color)}` : "That colour doesn't exist any more");
  }
}

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
setupCalibrationScreen(document.querySelector('#calibration-view'));

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
  if (name === 'chart') {
    // Coming back from another screen: the stash (palette) or my calibration
    // (finished size, bead shapes) may have changed.
    panel.showChart(chart.getChart());
    redraw();
  }
  if (name === 'charts') chartsScreen.render();
});
// setupViews() showed the first view before `views` was set, so redraw()
// skipped drawing then. Draw now.
redraw();
