# Bead Chart App

A personal web app for designing bead charts for jewelry (loom, square, brick, two-drop brick and peyote stitch, Miyuki round rocailles 11/0 and 15/0).

**We are building version 2. The current plan is in `PLAN-V2.md`.** `PLAN.md` is the v1 plan (sizing maths, colour list, data shapes) and still applies unless `PLAN-V2.md` changes it. **Read both before starting any task**, and follow their decisions, data shapes and the v2 build order.

## About me
- I know HTML and CSS well, but I'm new to JavaScript. Explain what you changed and why in plain language, briefly.
- I check every change in the browser with `npm run dev`.

## How to work
- Build **one milestone (or a smaller piece of one) at a time**, in the order in `PLAN-V2.md`. Don't jump ahead to later features.
- Keep each change small enough for me to test right away. Tell me what to click or check in the browser when you're done.
- After a step works, remind me to commit it (`git add .`, `git commit -m "..."`, `git push`).
- If something in the plan is unclear or seems wrong, ask me instead of guessing.

## Tech rules
- Vite + **plain JavaScript** (ES modules), HTML and CSS. **No frameworks** (no React, Vue, etc.) and no extra libraries unless I agree first.
- **Agreed for v2:** Tailwind CSS v4 (`@tailwindcss/vite`), Basecoat (`basecoat-css`) for the interface components, and Lucide (`lucide`) for icons. Nothing else without asking.
- The chart is drawn on a `<canvas>`. The rest of the interface (forms, palette, buttons) is normal HTML styled with Basecoat/Tailwind classes.
- Everything stitch-specific (bead orientation, offsets, sizing, reading order) lives in the stitch modules. Other code asks the module and never checks the stitch type itself.
- The layout has to work on a phone and tablet as well as the computer (touch, bigger tap targets).
- Keep code split into small, clearly named files in `src/` (e.g. `sizing.js` for the measurement maths).
- Put measurements in millimetres internally. Keep bead dimensions in one place so calibration can override them later.
- `src/data/miyuki-colors.json` is generated data. Don't edit it by hand. Read it, and store my changes (stash, custom colors, colour overrides) separately.
- Save my data in `localStorage` (no server, no accounts).
