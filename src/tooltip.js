// Small tooltips: hover over an element with data-tip="…" and, after a
// short pause, a label with that text appears above it (or below, if there's
// no room above).
// (Not "data-tooltip": Basecoat has its own CSS tooltips for that attribute.)
//
// One label is shared by everything, and it's placed on the page itself, so
// it isn't cut off by a scrolling panel. It's kept inside the panel's edges
// (or the window's). No tooltips for touch (there's no hover); keyboard
// focus shows them too.

const DELAY = 400; // milliseconds before the tooltip shows
const GAP = 6; // pixels between the element and the tooltip
const EDGE = 8; // keep this far from the edges of the window

// root: where to look for data-tip elements (e.g. the palette).
// The tooltip stays inside root's side panel, if it's in one.
export function setupTooltips(root) {
  const tip = document.createElement('div');
  tip.className = 'tooltip-bubble';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.append(tip);

  let timer = null;
  let current = null; // the element the tooltip is (or will be) for

  // The area the tooltip has to stay inside: the side panel, or the window.
  function bounds() {
    const panel = root.closest('.side-panel');
    if (panel) {
      const { left, right, top, bottom } = panel.getBoundingClientRect();
      return { left: left + EDGE, right: right - EDGE, top: top + EDGE, bottom: bottom - EDGE };
    }
    return { left: EDGE, right: window.innerWidth - EDGE, top: EDGE, bottom: window.innerHeight - EDGE };
  }

  function show(target) {
    const area = bounds();
    tip.textContent = target.dataset.tip;
    tip.style.maxWidth = `${area.right - area.left}px`; // long names wrap instead of sticking out
    tip.hidden = false;
    const box = target.getBoundingClientRect();
    const { width, height } = tip.getBoundingClientRect();
    let top = box.top - height - GAP;
    if (top < area.top) top = box.bottom + GAP; // no room above: put it below
    // Centred over the element, but moved in from the edges if needed.
    const left = Math.min(Math.max(box.left + box.width / 2 - width / 2, area.left), area.right - width);
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
  }

  function hide() {
    clearTimeout(timer);
    timer = null;
    current = null;
    tip.hidden = true;
  }

  function startFor(target) {
    if (target === current) return;
    hide();
    current = target;
    timer = setTimeout(() => show(target), DELAY);
  }

  root.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') return;
    const target = event.target.closest('[data-tip]');
    if (target && root.contains(target)) startFor(target);
  });
  root.addEventListener('pointerout', (event) => {
    // Only when the pointer really leaves the element (not just moves inside it).
    if (current && !current.contains(event.relatedTarget)) hide();
  });
  root.addEventListener('focusin', (event) => {
    const target = event.target.closest('[data-tip]');
    if (target) startFor(target);
  });
  root.addEventListener('focusout', hide);
  // Clicking, scrolling or the list being rebuilt: the tooltip would be in the wrong place.
  root.addEventListener('pointerdown', hide);
  window.addEventListener('scroll', hide, true);
  new MutationObserver(() => {
    if (current && !current.isConnected) hide();
  }).observe(root, { childList: true, subtree: true });
}
