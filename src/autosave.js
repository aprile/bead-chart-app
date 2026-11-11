// Saves the open chart automatically, shortly after you stop changing it.
// Each change restarts a short timer, so dragging across 50 beads saves once
// at the end, not 50 times.

import { getChart, onChange } from './chart.js';
import { saveChart, setCurrentChartId } from './storage.js';

const DELAY_MS = 800;

let timer = null; // waiting to save, or null if nothing is waiting
let paused = false; // true while importing a backup
let showStatus = () => {};

// statusCallback('saving' | 'saved' | 'error')
export function setupAutosave(statusCallback) {
  showStatus = statusCallback;
  onChange(scheduleSave);
  // If you close or hide the tab, save straight away instead of waiting.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
  });
  window.addEventListener('pagehide', flushSave);
}

function scheduleSave() {
  if (paused) return;
  clearTimeout(timer);
  timer = setTimeout(saveCurrentChart, DELAY_MS);
  showStatus('saving');
}

// Save now, whether or not anything changed (e.g. a brand new chart).
export function saveCurrentChart() {
  clearTimeout(timer);
  timer = null;
  const chart = getChart();
  chart.updatedAt = Date.now();
  const ok = saveChart(chart);
  setCurrentChartId(chart.id);
  showStatus(ok ? 'saved' : 'error');
  return ok;
}

// Save now, but only if a save is waiting.
export function flushSave() {
  if (timer !== null) saveCurrentChart();
}

// Forget a waiting save (e.g. the chart was just deleted).
export function cancelPendingSave() {
  clearTimeout(timer);
  timer = null;
  showStatus('saved');
}

export function pauseAutosave() {
  cancelPendingSave();
  paused = true;
}

export function resumeAutosave() {
  paused = false;
}
