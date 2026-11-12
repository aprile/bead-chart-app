// Dark mode follows my computer's or phone's setting.
// Basecoat's dark colours switch on when the page has the class "dark",
// so we add or remove it whenever the setting changes.

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

function update() {
  document.documentElement.classList.toggle('dark', prefersDark.matches);
}

export function setupDarkMode() {
  update();
  prefersDark.addEventListener('change', update);
}
