// Switches between the "Chart" and "My stash" views.
// The view is in the address bar (#chart or #stash), so normal links can
// switch views and a page refresh stays on the same one.

export function setupViews(onShow) {
  const views = {
    chart: document.querySelector('#chart-view'),
    stash: document.querySelector('#stash-view'),
  };
  const links = document.querySelectorAll('.view-switch a');

  function show() {
    const current = location.hash === '#stash' ? 'stash' : 'chart';
    for (const [name, view] of Object.entries(views)) {
      view.hidden = name !== current;
    }
    for (const link of links) {
      if (link.hash === `#${current}`) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    window.scrollTo(0, 0);
    onShow(current);
  }

  window.addEventListener('hashchange', show);
  show();

  return { isShowing: (name) => !views[name].hidden };
}
