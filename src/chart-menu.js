// The charts menu (▾ next to the chart name in the top bar).
// It lists my most recent charts (click one to open it), plus:
// New chart, Rename, Duplicate, Delete… and All charts… (the My charts screen).
//
// The menu itself (opening, closing, arrow keys) is Basecoat's dropdown menu.
// This file fills in the list of charts and says what each item does.

import { listSavedCharts } from './storage.js';
import { getStitch } from './stitches/index.js';
import { escapeHtml } from './html.js';
import { showIcons } from './icons.js';

const RECENT_COUNT = 8; // how many charts the menu lists

// root: the .dropdown-menu element.
// getOpenChartId(): the id of the chart that's open now.
// beforeShow(): runs before the list is built (to save the open chart, so its
//               newest name is listed).
// actions: { open(savedChart), new(), rename(), duplicate(), delete(), all() }
export function setupChartMenu(root, { getOpenChartId, beforeShow, actions }) {
  const list = root.querySelector('#chart-menu-charts');
  const charts = new Map(); // id → saved chart, for the charts listed right now

  // Rebuild the list just before the menu opens, so it's always up to date
  // (names, the open chart, newly made charts).
  // "Capture" runs this before Basecoat's own click/key handling opens the menu.
  const trigger = root.querySelector(':scope > button');
  const isClosed = () => trigger.getAttribute('aria-expanded') !== 'true';
  root.addEventListener('click', (event) => {
    if (trigger.contains(event.target) && isClosed()) showCharts();
  }, true);
  root.addEventListener('keydown', (event) => {
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key) && isClosed()) showCharts();
  }, true);

  function showCharts() {
    beforeShow();
    const openId = getOpenChartId();
    const recent = listSavedCharts().slice(0, RECENT_COUNT); // most recently changed first
    charts.clear();
    for (const saved of recent) charts.set(saved.id, saved);
    list.innerHTML = recent
      .map((saved) => {
        const stitch = getStitch(saved.stitch)?.label ?? '';
        const isOpen = saved.id === openId;
        return `
          <div role="menuitemradio" aria-checked="${isOpen}" data-chart-id="${escapeHtml(saved.id)}">
            <span class="chart-menu-name">${escapeHtml(saved.name)}</span>
            <span class="chart-menu-detail">${escapeHtml(stitch)} · ${saved.cols} × ${saved.rows}</span>
            <span data-indicator><i data-lucide="check"></i></span>
          </div>`;
      })
      .join('');
    showIcons(); // turn the new <i data-lucide> into icons
  }

  // Clicks on the items. (Basecoat closes the menu afterwards.)
  root.querySelector('[role="menu"]').addEventListener('click', (event) => {
    const chartItem = event.target.closest('[data-chart-id]');
    if (chartItem) {
      const saved = charts.get(chartItem.dataset.chartId);
      if (saved && saved.id !== getOpenChartId()) actions.open(saved);
      return;
    }
    const item = event.target.closest('[data-action]');
    if (item) actions[item.dataset.action]();
  });
}
