import './app.css';
// Basecoat's scripts for the interactive components (the panel tabs).
import 'basecoat-css/basecoat';
import 'basecoat-css/tabs';
import 'basecoat-css/dropdown-menu';
import 'basecoat-css/range'; // fills the slider track up to the thumb
import { setupDarkMode } from './dark-mode.js';
import { showIcons } from './icons.js';
import { setupPanels } from './panels.js';
import { setupTools } from './tools.js';
import { joinedArea } from './fill.js';
import { setupNewChartPanel } from './new-chart-panel.js';
import { setupPalette } from './palette.js';
import { setupBackgroundBead } from './background-bead.js';
import { setupSelection } from './selection-controls.js';
import { setupChartMenu } from './chart-menu.js';
import { setupPainting } from './painting.js';
import { setupStashScreen } from './stash-screen.js';
import { setupChartsScreen } from './charts-screen.js';
import { setupViews } from './views.js';
import { setupPhotoImport } from './photo.js';
import { setupCalibrationScreen } from './calibration-screen.js';
import { setupChartView } from './chart-view.js';
import { countMissingBeads, getColor, colorLabel } from './colors.js';
import { loadSavedChart, listSavedCharts, getCurrentChartId, setCurrentChartId, saveChart, deleteSavedChart } from './storage.js';
import { setupAutosave, saveCurrentChart, flushSave, cancelPendingSave } from './autosave.js';
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
  sideways: document.querySelector('#turn-sideways'),
  gridLines: document.querySelector('#show-grid-lines'),
  numbers: document.querySelector('#show-numbers'),
});

let views = null; // set up at the bottom, once the chart exists

function redraw() {
  // Only draw while the chart view is showing (a hidden canvas has no size).
  // Switching to the chart view calls redraw() again.
  if (!views || !views.isShowing('chart')) return;
  const current = chart.getChart();
  selection.fitTo(current); // undo or a resize may have made the chart smaller
  chartView.render(current);
  palette.show(current.beadSize); // the bead size or stash may have changed
  backgroundBead.show(current);
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

// Background bead (Chart tab). Changing it is one undo step.
const backgroundBead = setupBackgroundBead(document.querySelector('#right-panel'), {
  getBrushColorId: () => palette.getSelectedColorId(),
  onChoose(colorId) {
    chart.setBackgroundBead(colorId);
    redraw();
  },
});

const palette = setupPalette(document.querySelector('#palette'), {
  onSelect(colorId) {
    tools.showColor(colorId);
    if (chart.getChart()) backgroundBead.show(chart.getChart()); // "Use brush colour" depends on the brush colour
  },
  // Clicking a colour switches from the eraser or picker back to the brush.
  // Fill and Select use the colour too, so they stay.
  onPick() {
    if (['eraser', 'picker'].includes(tools.getTool())) tools.setTool('brush');
  },
});

// Select tool + the Selection buttons (copy, fill, erase, deselect).
const selection = setupSelection(document.querySelector('#left-panel'), {
  pasteBar: document.querySelector('#paste-bar'),
  chartView,
  getBrushColorId: () => palette.getSelectedColorId(),
  isActive: () => views?.isShowing('chart'),
  afterChange: () => redraw(),
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
  isPasting: () => selection.isPasting(),
  onSelectDrag: (phase, bead, point) => selection.onDrag(phase, bead, point),
  onStrokeEnd() {
    chartView.repaint(); // painting redraws single beads, which can cover the selection outline
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
  selection.clear();
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

// After the open chart is deleted: open the most recently changed chart
// that's left, or start a new one.
function openNextChart() {
  const next = listSavedCharts()[0];
  if (next) {
    chart.openChart(next);
    setCurrentChartId(next.id);
    showOpenChart();
  } else {
    startNewChart();
  }
}

function focusName() {
  // Wait a moment: closing the menu puts the focus back on its button first.
  setTimeout(() => {
    nameInput.focus();
    nameInput.select(); // ready to type a name
  });
}

// ---------- The charts menu (▾ next to the name) ----------

const STORAGE_FULL = "Couldn't save: the browser's storage is full. Export a backup, then delete some charts.";

setupChartMenu(document.querySelector('#chart-menu'), {
  getOpenChartId: () => chart.getChart().id,
  beforeShow: flushSave,
  actions: {
    open(saved) {
      openSavedChart(saved);
      location.hash = '#chart';
    },
    new() {
      startNewChart();
      location.hash = '#chart';
      focusName();
    },
    rename: focusName,
    duplicate() {
      flushSave();
      const current = chart.getChart();
      const now = Date.now();
      const copy = {
        ...structuredClone(current), // a full copy, beads and all
        id: crypto.randomUUID(),
        name: `${current.name} (copy)`,
        createdAt: now,
        updatedAt: now,
      };
      if (!saveChart(copy)) {
        alert(STORAGE_FULL);
        return;
      }
      openSavedChart(copy);
      location.hash = '#chart';
      focusName();
    },
    delete() {
      const current = chart.getChart();
      if (!confirm(`Delete “${current.name}”? This can't be undone.`)) return;
      cancelPendingSave(); // otherwise a waiting autosave would bring it back
      deleteSavedChart(current.id);
      openNextChart();
      location.hash = '#chart';
    },
    all() {
      location.hash = '#charts';
    },
  },
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
  if (selection.cancelPaste()) return; // while pasting, undo just cancels the paste
  if (chart.undo()) {
    panel.showChart(chart.getChart());
    redraw();
  }
}

function redo() {
  selection.cancelPaste();
  if (chart.redo()) {
    panel.showChart(chart.getChart());
    redraw();
  }
}

undoButton.addEventListener('click', undo);
redoButton.addEventListener('click', redo);

clearButton.addEventListener('click', () => {
  selection.cancelPaste();
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
    selection.cancelPaste();
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

// My stash opens as a dialog over the chart. Any button with data-open="stash"
// opens it (top bar, "Edit my stash", the empty palette's link).
const stash = setupStashScreen(document.querySelector('#stash-dialog'), {
  onClose: () => redraw(), // the palette shows the stash, and colours may have changed
});
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-open="stash"]')) stash.open();
});
setupCalibrationScreen(document.querySelector('#calibration-view'));

const chartsScreen = setupChartsScreen(document.querySelector('#charts-view'), {
  getOpenChartId: () => chart.getChart().id,
  openChart: openSavedChart,
  renameOpenChart(name) {
    chart.renameChart(name);
    nameInput.value = name;
    saveCurrentChart();
  },
  afterDeleteOpenChart: openNextChart,
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
