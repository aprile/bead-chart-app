// The Draw / Work switch in the top bar.
// - Draw: the normal drawing tools.
// - Work: for stitching from the chart. Painting is switched off so the chart
//   can't change by accident, the chart settings (Chart tab) are locked, and
//   the left panel shows the progress panel instead of the tools (the CSS
//   hides `.draw-only` and shows `.work-only`).
// Remembered between visits. Saved as "draw" or "work".

import { load, save, STORAGE_KEYS } from './storage.js';

// app: the element holding the whole app; it gets data-mode="draw" or "work".
// switchRoot: the button group with the two buttons (data-mode="draw" / "work").
// settings: a <fieldset> around the chart settings; disabled while working.
// onChange(mode): called after switching (not at start-up).
export function setupWorkMode(app, switchRoot, settings, { onChange }) {
  const buttons = switchRoot.querySelectorAll('[data-mode]');
  let mode = load(STORAGE_KEYS.mode) === 'work' ? 'work' : 'draw';

  function show() {
    app.dataset.mode = mode;
    // A disabled fieldset switches off every field and button inside it.
    settings.disabled = mode === 'work';
    for (const button of buttons) {
      button.setAttribute('aria-pressed', button.dataset.mode === mode);
    }
  }

  for (const button of buttons) {
    button.addEventListener('click', () => {
      if (button.dataset.mode === mode) return;
      mode = button.dataset.mode;
      save(STORAGE_KEYS.mode, mode);
      show();
      onChange(mode);
    });
  }

  show();

  return {
    isWorking: () => mode === 'work',
  };
}
