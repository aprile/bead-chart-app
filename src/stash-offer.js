// The "Add these colours to your stash?" dialog. Shown after importing a
// chart or a photo that uses Miyuki colours I don't have in my stash, since
// the palette only shows my stash.

import { getColor, colorLabel, isInStash, setInStash } from './colors.js';
import { escapeHtml } from './html.js';

// The Miyuki colours (not custom ones, which are always in the stash) among
// `ids` that aren't in my stash for this bead size.
export function colorsNotInStash(ids, size) {
  return [...new Set(ids)]
    .filter((id) => id !== null)
    .map(getColor)
    .filter((color) => color && !color.custom && !isInStash(color.id, size));
}

// dialog: the <dialog>. onStashChange(): the stash changed (update the palette).
// Returns { offer({ colors, size, message }) }.
export function setupStashOffer(dialog, { onStashChange }) {
  const form = dialog.querySelector('form');
  const messageText = dialog.querySelector('.import-colors-message');
  const list = dialog.querySelector('.import-colors-list');
  let toAdd = { colors: [], size: null };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    for (const color of toAdd.colors) setInStash(color.id, toAdd.size, true);
    dialog.close();
    onStashChange();
  });
  dialog.querySelector('[data-action="cancel"]').addEventListener('click', () => dialog.close());

  return {
    // Shows the dialog (if there's anything to add).
    offer({ colors, size, message }) {
      if (colors.length === 0) return;
      toAdd = { colors, size };
      messageText.textContent = message;
      list.innerHTML = colors
        .map((color) => `
          <li>
            <span class="swatch-inline" style="background: ${escapeHtml(color.hex)}"></span>
            ${escapeHtml(colorLabel(color))}
          </li>`)
        .join('');
      dialog.showModal();
    },
  };
}
