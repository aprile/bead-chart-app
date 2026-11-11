import './style.css';
import { setupNewChartPanel } from './new-chart-panel.js';
import { drawGrid } from './grid.js';

const canvas = document.querySelector('#chart-canvas');
let currentChart = null; // the last chart size the form gave us

function redraw() {
  // Hide the canvas while the form has invalid numbers.
  canvas.hidden = !currentChart;
  if (currentChart) drawGrid(canvas, currentChart);
}

setupNewChartPanel(document.querySelector('#new-chart-form'), (chart) => {
  currentChart = chart;
  redraw();
});

// Resizing the window (or moving it to another screen) changes the space available.
window.addEventListener('resize', redraw);
