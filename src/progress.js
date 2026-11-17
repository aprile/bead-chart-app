// Working mode's progress: which row I'm on.
// - The progress panel (left panel in work mode): "Rows 1 & 2 of 90", which
//   way the row goes, and Next row / Previous row.
// - On the canvas: finished rows are faded, the current row is outlined.
// - Clicking a bead (in work mode) makes its row the current row.
//
// The rows come from the stitch module (workRows): one working row can be
// two chart rows (two-drop brick) or every other bead of one (peyote).
// The current row is saved with the chart (chart.js setProgress), not part of undo.

import { getStitch } from './stitches/index.js';
import { drawWorkRows } from './grid.js';
import { getChart, setProgress } from './chart.js';

// Which way the current row runs on screen, in words (data-dir turns the arrow).
const DIRECTION_WORDS = {
  right: 'Left to right',
  left: 'Right to left',
  down: 'Top to bottom',
  up: 'Bottom to top',
};

// root: the progress section of the left panel.
// isWorking(): true in work mode.
export function setupProgress(root, { chartView, isWorking }) {
  const label = root.querySelector('#progress-label');
  const total = root.querySelector('#progress-total');
  const direction = root.querySelector('#progress-direction');
  const directionText = root.querySelector('#progress-direction-text');
  const nextButton = root.querySelector('#progress-next');
  const previousButton = root.querySelector('#progress-previous');

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
    nextButton.disabled = index === workRows.length - 1;
  }

  function goTo(index) {
    const chart = getChart();
    const count = rowsOf(chart).workRows.length;
    setProgress(Math.min(Math.max(index, 0), count - 1));
    show();
    chartView.repaint();
  }

  nextButton.addEventListener('click', () => goTo(currentIndex(getChart()) + 1));
  previousButton.addEventListener('click', () => goTo(currentIndex(getChart()) - 1));

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
    // A click on bead (row, col) in work mode: start working on its row.
    jumpTo({ row, col }) {
      const chart = getChart();
      goTo(rowsOf(chart).rowOf[row * chart.cols + col]);
    },
  };
}
