// The "My charts" screen: list saved charts (open, rename, duplicate, delete),
// and export/import the backup file.

import {
  listSavedCharts, saveChart, deleteSavedChart,
  downloadBackup, checkBackup, restoreBackup, describeData, describeCurrentData,
} from './storage.js';
import { flushSave, cancelPendingSave, pauseAutosave, resumeAutosave } from './autosave.js';
import { calculateChartSize, formatLength } from './sizing.js';
import { drawPreview } from './grid.js';
import { DEFAULT_NAME } from './chart.js';
import { escapeHtml } from './html.js';

const STITCH_NAMES = { loom: 'Loom', brick: 'Brick stitch' };
const STORAGE_FULL = "Couldn't save: the browser's storage is full. Export a backup, then delete some charts.";

// e.g. "11 Nov 2026, 15:42", in your computer's language and time zone.
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function itemHtml(chart, isOpen) {
  const size = calculateChartSize(chart);
  return `
    <li data-id="${escapeHtml(chart.id)}">
      <div class="chart-preview"><canvas></canvas></div>
      <div class="chart-info">
        <strong>${escapeHtml(chart.name || DEFAULT_NAME)}</strong>
        ${isOpen ? '<span class="badge">open</span>' : ''}
        <span class="note">
          ${STITCH_NAMES[chart.stitch]} · ${chart.beadSize} ·
          ${formatLength(size.realWidthMm, 'cm')} × ${formatLength(size.realHeightMm, 'cm')}
          (${chart.cols} × ${chart.rows} beads)
        </span>
        <span class="note">Changed ${chart.updatedAt ? dateFormat.format(chart.updatedAt) : '–'}</span>
      </div>
      <div class="chart-actions">
        <button type="button" class="primary" data-action="open">Open</button>
        <button type="button" data-action="rename">Rename</button>
        <button type="button" data-action="duplicate">Duplicate</button>
        <button type="button" class="danger" data-action="delete">Delete</button>
      </div>
    </li>`;
}

// app = functions from main.js that work on the open chart:
// { getOpenChartId, openChart(saved), renameOpenChart(name), afterDeleteOpenChart(), newChart() }
export function setupChartsScreen(root, app) {
  const list = root.querySelector('#charts-list');
  const backupStatus = root.querySelector('#backup-status');
  const importInput = root.querySelector('#import-file');
  let charts = [];

  function render() {
    flushSave(); // so the open chart's latest changes show in the list
    charts = listSavedCharts();
    if (charts.length === 0) {
      list.innerHTML = '<li class="empty">No saved charts yet.</li>';
      return;
    }
    list.innerHTML = charts.map((chart) => itemHtml(chart, chart.id === app.getOpenChartId())).join('');
    list.querySelectorAll('canvas').forEach((canvas, i) => drawPreview(canvas, charts[i], 72, 96));
  }

  const actions = {
    open(saved) {
      app.openChart(saved);
      location.hash = '#chart';
    },

    rename(saved) {
      const name = prompt('New name for this chart:', saved.name);
      if (name === null) return; // Cancel
      const cleanName = name.trim() || DEFAULT_NAME;
      if (saved.id === app.getOpenChartId()) {
        app.renameOpenChart(cleanName);
      } else {
        saved.name = cleanName;
        saved.updatedAt = Date.now();
        if (!saveChart(saved)) alert(STORAGE_FULL);
      }
      render();
    },

    duplicate(saved) {
      const now = Date.now();
      const copy = { ...saved, id: crypto.randomUUID(), name: `${saved.name} (copy)`, createdAt: now, updatedAt: now };
      if (!saveChart(copy)) alert(STORAGE_FULL);
      render();
    },

    delete(saved) {
      if (!confirm(`Delete “${saved.name || DEFAULT_NAME}”? This can't be undone.`)) return;
      if (saved.id === app.getOpenChartId()) {
        cancelPendingSave(); // otherwise a waiting autosave would bring it back
        deleteSavedChart(saved.id);
        app.afterDeleteOpenChart();
      } else {
        deleteSavedChart(saved.id);
      }
      render();
    },
  };

  list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const saved = charts.find((chart) => chart.id === button.closest('li').dataset.id);
    if (saved) actions[button.dataset.action](saved);
  });

  root.querySelector('#charts-new-button').addEventListener('click', () => {
    app.newChart();
    location.hash = '#chart';
  });

  // ---------- Backup ----------

  root.querySelector('#export-button').addEventListener('click', () => {
    flushSave();
    const backup = downloadBackup();
    backupStatus.textContent = `Backup downloaded: ${describeData(backup)}.`;
  });

  // The real file picker is a hidden <input type="file">; our button clicks it.
  root.querySelector('#import-button').addEventListener('click', () => importInput.click());

  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    importInput.value = ''; // so choosing the same file again still works
    if (!file) return;

    let data;
    try {
      data = JSON.parse(await file.text()); // await = wait for the file to be read
    } catch {
      alert("This file can't be read. Is it a Bead Chart backup (.json)?");
      return;
    }

    const check = checkBackup(data);
    if (!check.ok) {
      alert(`Can't import this file. ${check.error}`);
      return;
    }

    flushSave();
    const replace = confirm(
      `This backup (${file.name}) contains:\n${check.summary}\n\n` +
        `Importing REPLACES everything you have now:\n${describeCurrentData()}\n\n` +
        `Tip: cancel and export a backup first if you might want your current data back.\n\n` +
        `Replace your data with this backup?`,
    );
    if (!replace) return;

    pauseAutosave(); // stop the open chart from being saved over the imported data
    if (restoreBackup(data)) {
      location.reload(); // start the app fresh with the imported data
    } else {
      resumeAutosave();
      alert("The import didn't work (the browser's storage may be full). Your data hasn't changed.");
    }
  });

  return { render };
}
