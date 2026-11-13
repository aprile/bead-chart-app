// Switches between the views: "Chart", "My charts" and "Calibration".
// (My stash is a dialog over the chart: see stash-screen.js.)
// The chart view is the workspace (panels + canvas); the others are pages
// that share one scrolling area.
// The view is in the address bar (#chart, #charts or #calibration), so normal links
// can switch views and a page refresh stays on the same one.

export function setupViews(onShow) {
  const views = {
    chart: document.querySelector('#chart-view'),
    charts: document.querySelector('#charts-view'),
    calibration: document.querySelector('#calibration-view'),
  };
  const pages = document.querySelector('#pages');
  const links = document.querySelectorAll('.view-switch a');

  function show() {
    const wanted = location.hash.slice(1); // "#charts" → "charts"
    const current = Object.hasOwn(views, wanted) ? wanted : 'chart';
    for (const [name, view] of Object.entries(views)) {
      view.hidden = name !== current;
    }
    pages.hidden = current === 'chart';
    pages.scrollTop = 0;
    for (const link of links) {
      if (link.hash === `#${current}`) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    onShow(current);
  }

  window.addEventListener('hashchange', show);
  show();

  return { isShowing: (name) => !views[name].hidden };
}
