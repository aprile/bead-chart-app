// Working mode's progress: which row I'm on.
// - The progress panel (left panel in work mode): "Rows 1 & 2 of 90", which
//   way the row goes, Next row / Previous row (also ↑/↓ and space), and the
//   row's colours in pick-up order ("3 × 401 Black"), and Start again.
// - The chart scrolls by itself to keep the current row in view.
// - On the canvas: finished rows are faded, the current row is outlined.
// - Clicking a bead (in work mode) makes its row the current row.
//
// The rows come from the stitch module (workRows): one working row can be
// two chart rows (two-drop brick) or every other bead of one (peyote).
// The current row is saved with the chart (chart.js setProgress), not part of undo.

import { getStitch } from './stitches/index.js';
import { drawWorkRows, beadsBox } from './grid.js';
import { getChart, setProgress } from './chart.js';
import { getColor, colorLabel } from './colors.js';

// Which way the current row runs on screen, in words (data-dir turns the arrow).
const DIRECTION_WORDS = {
  right: 'Left to right',
  left: 'Right to left',
  down: 'Top to bottom',
  up: 'Bottom to top',
};

// The beads of a row in pick-up order, grouped where the same colour comes
// several times in a row: [{ colorId, count }, …]. Empty beads count as the
// background bead (they're stitched in it).
function colorRuns(chart, workRow) {
  const runs = [];
  for (const { row, col } of workRow.beads) {
    const colorId = chart.beads[row][col] ?? chart.backgroundBead ?? null;
    const last = runs.at(-1);
    if (last && last.colorId === colorId) last.count++;
    else runs.push({ colorId, count: 1 });
  }
  return runs;
}

// One line of the colour list: swatch, "3 ×", the colour's code and name.
function runItem({ colorId, count }) {
  const color = colorId === null ? null : getColor(colorId);
  const item = document.createElement('li');
  const swatch = document.createElement('span');
  swatch.className = 'current-swatch';
  const name = document.createElement('span');
  name.className = 'progress-color-name';
  if (color) {
    swatch.style.setProperty('--swatch', color.hex);
    name.textContent = colorLabel(color);
  } else {
    // No background bead (empty), or a colour that no longer exists.
    name.textContent = colorId === null ? 'Empty (no background bead)' : 'Missing colour';
    name.classList.add('progress-color-unknown');
  }
  const times = document.createElement('span');
  times.className = 'progress-count';
  times.textContent = `${count} ×`;
  item.append(times, swatch, name);
  return item;
}

// root: the progress section of the left panel.
// isWorking(): true in work mode.
// isActive(): true while the chart screen is showing (for the keyboard keys).
export function setupProgress(root, { chartView, isWorking, isActive }) {
  const label = root.querySelector('#progress-label');
  const colorList = root.querySelector('#progress-colors');
  const total = root.querySelector('#progress-total');
  const direction = root.querySelector('#progress-direction');
  const directionText = root.querySelector('#progress-direction-text');
  const nextButton = root.querySelector('#progress-next');
  const previousButton = root.querySelector('#progress-previous');
  const resetButton = root.querySelector('#progress-reset');

  // The working rows, worked out again only when the stitch or size changes.
  let cached = null;
  function rowsOf(chart) {
    const key = `${chart.stitch} ${chart.cols} ${chart.rows}`;
    if (cached?.key !== key) {
      const workRows = getStitch(chart.stitch).workRows(chart.cols, chart.rows);
      // For each bead, which working row it's in: rowOf[row * cols + col].
      const rowOf = new Int32Array(chart.rows * chart.cols);
      workRows.forEach((workRow, index) => {
        for (const { row, col } of workRow.beads) rowOf[row * chart.cols + col] = index;
      });
      cached = { key, workRows, rowOf };
    }
    return cached;
  }

  // The row I'm on. After a resize the saved row may be past the end:
  // then it's the last row.
  function currentIndex(chart) {
    const count = rowsOf(chart).workRows.length;
    return Math.min(Math.max(chart.progress?.row ?? 0, 0), count - 1);
  }

  // Which way a working row runs on screen. Rows are listed in pick-up
  // order, so compare its first and last bead. Turned sideways, the chart's
  // left-to-right runs down the screen.
  function screenDirection(workRow) {
    const first = workRow.beads[0];
    const last = workRow.beads.at(-1);
    if (first.col === last.col) return null; // one column: no direction
    const forwards = last.col > first.col;
    if (chartView.isSideways()) return forwards ? 'down' : 'up';
    return forwards ? 'right' : 'left';
  }

  // Update the panel's text and buttons.
  function show() {
    const chart = getChart();
    if (!chart) return;
    const { workRows } = rowsOf(chart);
    const index = currentIndex(chart);
    const workRow = workRows[index];
    label.textContent = workRow.label;
    total.textContent = `of ${workRows.at(-1).last}`;
    const dir = screenDirection(workRow);
    direction.hidden = !dir;
    if (dir) {
      direction.dataset.dir = dir;
      directionText.textContent = DIRECTION_WORDS[dir];
    }
    previousButton.disabled = index === 0;
    resetButton.disabled = index === 0;
    nextButton.disabled = index === workRows.length - 1;
    showColors(chart, workRow);
  }

  // The row's colours in pick-up order. Only rebuilt when something in it
  // changed, since show() runs on every redraw (e.g. while scrolling).
  let shownColors = '';
  function showColors(chart, workRow) {
    const runs = colorRuns(chart, workRow);
    // The screen colours are in the key too, in case I edited one in my stash.
    const key = JSON.stringify(runs.map((run) => [run.count, run.colorId, getColor(run.colorId)?.hex]));
    if (key === shownColors && colorList.childElementCount > 0) return;
    shownColors = key;
    colorList.replaceChildren(...runs.map(runItem));
  }

  function goTo(index) {
    const chart = getChart();
    const count = rowsOf(chart).workRows.length;
    setProgress(Math.min(Math.max(index, 0), count - 1));
    show();
    chartView.repaint();
    reveal({ smooth: true });
  }

  // Scroll the chart so the current row is in view (if it isn't already).
  function reveal({ smooth = false } = {}) {
    const chart = getChart();
    const layout = chartView.getLayout();
    if (!chart || !layout || !isWorking()) return;
    const workRow = rowsOf(chart).workRows[currentIndex(chart)];
    chartView.scrollToShow(beadsBox(layout, workRow.beads), { smooth });
  }

  // Start again: back to the first row, after asking.
  resetButton.addEventListener('click', () => {
    if (!confirm('Start again from the first row? Your rows done will be cleared.')) return;
    goTo(0);
  });

  const next = () => goTo(currentIndex(getChart()) + 1);
  const previous = () => goTo(currentIndex(getChart()) - 1);
  nextButton.addEventListener('click', next);
  previousButton.addEventListener('click', previous);

  // Keyboard, in work mode: ↑ or → or space = next row, ↓ or ← = previous row.
  // (Rows go up the chart, or to the right when it's turned sideways.)
  window.addEventListener('keydown', (event) => {
    if (!isWorking() || !isActive()) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    // Not while typing or in a dialog. Space on a button already clicks it.
    if (event.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (event.key === ' ' && event.target.closest?.('button')) return;
    if (document.querySelector('dialog[open]')) return;
    if (['ArrowUp', 'ArrowRight', ' '].includes(event.key)) next();
    else if (['ArrowDown', 'ArrowLeft'].includes(event.key)) previous();
    else return;
    event.preventDefault(); // otherwise the arrows and space also scroll the chart
  });

  // Fade the finished rows and outline the current one, after every redraw.
  chartView.addOverlay((canvas, layout) => {
    if (!isWorking()) return;
    const chart = getChart();
    const { rowOf } = rowsOf(chart);
    drawWorkRows(canvas, layout, (row, col) => rowOf[row * chart.cols + col], currentIndex(chart));
    show(); // e.g. turning the chart sideways changes the direction words
  });

  return {
    show,
    // Scroll the current row into view (on switching to work mode, or opening a chart).
    reveal,
    // A click on bead (row, col) in work mode: start working on its row.
    jumpTo({ row, col }) {
      const chart = getChart();
      goTo(rowsOf(chart).rowOf[row * chart.cols + col]);
    },
  };
}
