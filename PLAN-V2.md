# Bead Chart App — Version 2 Plan

Builds on `PLAN.md` (v1). Everything there still applies unless this doc changes it.

## v2 goals
1. **More stitches:** square stitch, flat peyote (even and odd count), and two-drop brick stitch (two rows at a time).
2. **New layout:** big canvas in the middle with collapsible side panels. **It also has to work on a phone or tablet.**
3. **Design polish** with **Basecoat**, the shadcn/ui design system without React.
4. **Single-file export/import:** one chart as `.json`, and a chart picture as `.png`. The full backup stays as it is.
5. **Working mode:** switch between drawing and working. In working mode I mark my current row *and* the exact bead I'm on.
6. **Background bead**, set per chart (changed 2026-11-13 from a canvas colour, see section 6).
7. **Marquee selection** with copy/paste, fill and erase (added 2026-11-13, see section 7).

## Decisions (2026-11-12)
- **Components:** Basecoat (shadcn/ui look and themes, plain JavaScript). Real shadcn/ui needs React, which would mean rewriting the interface, so I chose not to use it.
- **Brick two rows at a time** = two-drop brick stitch: pairs of rows stacked straight, with the half-bead offset between pairs.
- **Start corner:** always **bottom-left** for every stitch. No setting for it.
- **Phone/tablet:** yes. Working mode will mostly be used on a phone or tablet next to the beads.

## 1. Stitches

### Rebuild stitches as "stitch modules" first
Before adding three more stitches, loom and brick move into small modules that all have the same shape. New stitches then plug in without touching the rest:

- `id`, `label`
- **bead orientation:** which way the holes run (sets column width and row height from the bead size or calibration)
- **cell positions:** where bead (row, col) sits on the canvas, including offsets
- **sizing:** mm → bead count, and bead count → real finished size (with overhang)
- **reading order:** the order beads are actually stitched in, starting bottom-left (used by working mode)

The grid, painting, photo import and export then only talk to the module.

### The stitches
| Stitch | Holes run | Offset | Sizing note | Reading order (from bottom-left) |
|---|---|---|---|---|
| Loom (v1) | horizontally | none | as v1 | row by row, going up; each row is one pick-up, left to right |
| **Square stitch** | horizontally | none | same maths as loom | row by row, going up, alternating direction |
| Brick (v1) | vertically | every row shifted ½ bead | width includes ½-bead overhang | row by row, going up, alternating direction |
| **Two-drop brick** | vertically | rows in pairs; each pair shifted ½ bead from the next | as brick | two rows at a time, pair by pair, alternating direction |
| **Flat peyote** | horizontally | every other column shifted ½ bead up/down | **height** includes the ½-bead overhang | zig-zag rows (each row is every other bead), going up; rows 1 and 2 picked up together |

- **Peyote even/odd count** is a setting on the chart. It doesn't change the drawing, only how the row ends work, so working mode shows the right turn at the end of each row.
- **Calibration** is saved per stitch, since each one comes out slightly differently. Square stitch starts from the loom values, and two-drop brick from the brick values.
- **Photo import** works unchanged, since it only needs each bead's position from the stitch module.

## 2. Layout (canvas-first, works on phone and tablet)

**Desktop / landscape tablet**
```
┌──────────────────────────────────────────────────────────────┐
│ Chart name ▾   [ Draw | Work ]           Export ▾   Stash   ⚙ │
├────────┬─────────────────────────────────────────┬───────────┤
│ Tools  │                                         │ Palette   │
│ brush  │                                         │ (stash,   │
│ eraser │              CANVAS                     │  this     │
│ fill   │                                         │  size)    │
│ picker │                                         │───────────│
│        │                                         │ Chart     │
│ undo   │                                         │ settings  │
│ redo   │                          − 100% + ⤢     │ bg colour │
└────────┴─────────────────────────────────────────┴───────────┘
```

**Phone / portrait tablet**
```
┌───────────────────────────┐
│ Name ▾  [Draw|Work]   ⋯   │
├───────────────────────────┤
│                           │
│          CANVAS           │
│   (pinch zoom, drag pan)  │
│                           │
├───────────────────────────┤
│ bottom panel (swipe up):  │
│ tools + palette, or the   │
│ progress panel in Work    │
└───────────────────────────┘
```

- **Top bar:** chart switcher (rename, duplicate, new, delete), the **Draw / Work** switch, the Export menu, Stash, settings. On a phone, Export, Stash and settings go into a `⋯` menu.
- **Left panel:** drawing tools. In working mode it becomes the **progress panel** (see 5).
- **Right panel:** tabs for **Palette** and **Chart** (stitch, size, peyote count, background colour, grid lines on/off).
- **Canvas:** fills the rest. Zoom controls and "fit to screen" in the bottom-right corner.
- Both side panels can collapse, so a long bracelet chart can use the whole width.
- **On small screens** the side panels turn into one **bottom panel** you swipe up, with tabs (Tools / Palette / Chart). Pinch to zoom, two fingers to pan, one finger to paint.
- Buttons and colour swatches are **at least 44 px** on touch screens.
- The stash screen and photo import open as **dialogs** over the chart (full screen on a phone) instead of replacing it.

## 3. Component library: Basecoat

**[Basecoat](https://basecoatui.com)** brings the shadcn/ui look to plain HTML and JavaScript. It's free and open source (MIT).

Why it fits this app:
- **Same look as shadcn/ui, without React.** It uses shadcn's design and is **compatible with shadcn/ui themes**, so any shadcn theme can be dropped in.
- **No change to the v1 code style:** Vite + plain JavaScript stays. Components are plain HTML with Basecoat classes, plus a small script for the interactive ones (dialogs, dropdowns, tabs).
- **Dark mode** is built in. This pairs nicely with dark canvas backgrounds.

What gets added to the project:
- **Tailwind CSS v4** (via the `@tailwindcss/vite` plugin), which Basecoat is built on.
- **`basecoat-css`** from npm, imported in the main CSS file.
- **Lucide icons** (the icon set shadcn uses), via the plain-JavaScript `lucide` package.
- A `theme.css` holding the chosen shadcn theme colours, radius and font.

Components we'll use: button, button group, dropdown menu, dialog, tabs, select, input, switch, slider, tooltip, popover, toast (e.g. "Chart exported"), badge, card.
- **Colour picker:** Basecoat doesn't include one. We'll use the browser's own colour input, styled to match, inside a popover with preset swatches.
- **Bottom panel on a phone:** built from Basecoat's styling plus a little custom code, since there's no ready-made sheet component.

Plan:
- Install Tailwind + Basecoat, choose a shadcn theme (light and dark), and set it in `theme.css`.
- Replace v1's hand-made buttons, form fields and modals one screen at a time.
- **The canvas stays plain `<canvas>`.** Basecoat is only for the controls around it.

## 4. Export and import

### Single chart file (`.json`)
- **Export → Chart file** saves one chart.
- The file is **self-contained**: it includes the chart, the **custom colours it uses**, and any **screen-colour overrides** for the built-in colours it uses. It opens correctly on a fresh install.
- It has a header so the app knows what it is: `{ "type": "bead-chart", "version": 2, ... }`.
- **Import → Chart file:**
  - always adds it as a **new chart** and never overwrites one. If the name is taken it becomes "Name (2)".
  - **Custom colours:** if a colour with the same name and screen colour already exists, the chart uses that one. Otherwise it's added as a new custom colour and put in the stash.
  - **Built-in colours missing from my stash:** the import says which ones and offers to add them to the stash.
- Files from v1 still import (see "Data changes").
- On a phone, export uses the share sheet where the browser supports it, so the file can go straight to Files, AirDrop or a message.
- This is also how a chart moves between computer and phone, since each browser saves its own charts.

### Chart picture (`.png`)
- **Export → Image.** Options: scale (bead size in pixels), grid lines on/off, background colour or transparent.
- **Optional colour key** under the chart: swatch, code, name, and bead count for each colour. This is the "bead count per colour" item from v1's later list, and it's cheap to add here.

### Full backup
Stays as in v1 (all charts + stash + custom colours + calibration), now with `version: 2`.

## 5. Working mode

The **Draw / Work** switch is in the top bar. In working mode, painting is switched off so I can't change the chart by accident.

**On the canvas**
- Work **always starts at the bottom-left bead** and goes up.
- The **current row** is highlighted. Finished rows are dimmed, and rows still to do stay normal.
- The **current bead** has a clear marker (ring or arrow), plus a small arrow showing which way the row goes.
- Tapping any bead moves the marker there.
- The canvas scrolls by itself to keep the current row in view.

**Progress panel** (left panel on desktop, bottom panel on phone)
- "Row 12 of 90 · bead 7 of 15"
- **The current row written out in order**, grouped by colour: e.g. `3 × 401 Black · 2 × 4201 Duracoat Silver · 5 × 401 Black`. The group I'm on is highlighted.
- Buttons: **next bead / previous bead**, **next row / previous row**, **mark row done**.
- **On a phone:** a large "next bead" button at thumb height, with the other buttons smaller next to it. Swiping on the panel also moves bead by bead.
- Keyboard on desktop: arrow keys for bead/row, space for next bead.
- For peyote it follows the zig-zag rows and shows the turn for even or odd count. For two-drop brick it moves two rows at a time.
- **Keep screen on** while in working mode (on browsers that support it), so the phone doesn't lock mid-row.

**Saving**
- Progress is saved **per chart** (row, bead, rows done) and comes back when I reopen the chart.
- Progress isn't part of undo/redo.
- **Reset progress** asks first.
- If I go back to drawing mode and change the chart size, progress outside the new size is cleared.

## 6. Background bead (changed 2026-11-13)
- Instead of a canvas colour, each chart can have a **background bead**: a stash colour that every empty bead is stitched in. Set in the **Chart** tab ("Use brush colour" / "None"). Changing it is one undo step.
- Empty beads are drawn in that colour, so they look like (and are) real beads. With no background bead they stay light grey.
- The eraser paints beads back to the background bead. The picker on an empty bead still switches to the eraser.
- Counted like a colour: deleting a stash colour that's the background asks for a replacement, and colour counts include the empty beads.
- **10-bead lines** turn light on a dark background bead so they stay visible.
- The PNG export (milestone 7) draws empty beads in the background bead colour; "transparent" leaves them out.

## 7. Marquee selection (added 2026-11-13)
- A **Select** tool: drag a rectangle of beads (rows × columns, so on brick/peyote the edges follow the beads).
- With a selection: **copy**, **paste**, **fill** (with the brush colour) and **erase**.
- **Paste** puts the copied beads over the chart as a floating piece. Drag it into place, then drop it (Enter, click outside or a Done button). Esc cancels.
- **Empty beads in the copy are see-through:** they leave the beads underneath alone.
- **Snap to keep the shape:** on stitches with offsets the piece only moves in steps that keep the same offsets (every 2nd row on brick, 4th row on two-drop brick, 2nd column on peyote). Worked out by comparing the stitch module's `cellOffset` at the old and new position. A piece copied from a different stitch, whose shape can't be kept, moves freely.
- Each paste, fill or erase is one undo step.

## Data changes (version 2)
- **Chart:**
  ```
  {
    version: 2,
    name,
    stitch: "loom" | "square" | "brick" | "brick2" | "peyote",
    peyoteCount?: "even" | "odd",
    beadSize, widthMm, heightMm, cols, rows,
    beads: [[colorId | null, ...], ...],
    backgroundBead: colorId | null,       // was `background: "#f5f1ea"` (never used); upgraded on load
    progress?: { step, doneRows: [..] }   // step = position in the stitch's reading order
  }
  ```
- **Single chart file:** `{ type: "bead-chart", version: 2, chart, customColors: [...], hexOverrides: { id: hex } }`
- **Calibration:** keyed by stitch and bead size.
- **Migration:** when the app loads v1 data (localStorage or an imported file), it adds `version: 2`, no background bead (`backgroundBead: null`) and no progress. Nothing else changes, so v1 charts open as they were.

## Build order (milestones)
1. **Stitch modules:** move loom and brick into modules with no visible change, and add `version` + migration. Check v1 charts look identical.
2. **New stitches:** square, then two-drop brick, then peyote (the trickiest because of the vertical offset and zig-zag rows).
3. **Tailwind + Basecoat + new layout:** install, pick a theme, the canvas-first shell, side panels, chart switcher, dialogs for stash and photo import.
4. **Phone/tablet layout:** bottom panel, touch gestures (pinch zoom, pan, paint), bigger touch targets. Test on a real phone with `npm run dev -- --host`.
5. ~~Background colour~~ (done early as the background bead, see section 6).
6. **Single chart export/import** (.json), including the custom colour merge rules and the share sheet.
7. **PNG export** with the optional colour key.
8. **Working mode:** switch, row/bead marker, progress panel, phone controls, keyboard shortcuts, keep screen on, saved progress, peyote and two-drop rows.
9. **Polish:** empty states, tooltips on tools, dark mode check, a final visual pass.

## Not in v2
- Tubular/circular peyote, herringbone, right-angle weave, netting
- Shapes other than rectangles/squares
- Printable PDF pattern (the PNG with colour key covers sharing for now)
- Installing as a phone app (PWA) / offline use on the phone. A good candidate for v3, since working mode will be used on a phone.
- Accounts, hosting, sharing. **Note:** to use the app on a phone *away from the computer*, it will eventually need hosting (e.g. a free static host). For now the phone uses the dev server over home Wi-Fi.

## Progress
- **Milestone 1 done.** Loom and brick are stitch modules in `src/stitches/`; charts have `version: 2` and a default background (`#faf9f7`), and v1 data is upgraded on load (`src/migrate.js`).
- **Milestone 2 done.** Square stitch (starts from loom calibration), two-drop brick (pairs counted from the bottom; starts from brick calibration), flat peyote (rightmost column sits low).
- **Milestone 3 in progress.**
  - Step 1 done: Tailwind + Basecoat (**Nova** style pack + the chosen shadcn theme in `src/theme.css`) + Lucide installed; dark mode follows the system setting.
  - Step 2a: Tailwind's preflight is on. The v1 CSS (`style.css`) is in a `v1` layer below Basecoat, and only applies inside `class="v1"` (its colours are `--v1-*`, its badge is `.v1-badge`). Screens drop `v1` as they're rebuilt.
  - Step 2b: canvas-first layout (desktop). Top bar (panel toggles, chart name, New chart, screen links), left Tools panel (brush/eraser, undo/redo/clear, import photo), canvas filling the middle with floating zoom controls, right panel with Palette / Chart tabs. Panels can be hidden (remembered). Other screens still v1, in a scrolling area. Styles in `src/layout.css` (layer `app`).
  - Added (from the layout sketch, agreed 2026-11-12): **fill** and **picker** tools. Fill paints the joined beads of one colour (one undo step); "joined" = cells sharing an edge, worked out from each stitch module's `cellOffset` (`neighbours()` in `src/stitches/index.js`). Picker chooses a bead's colour in the palette (empty bead → eraser).
  - Added 2026-11-13 (asked for before polish): grid lines show only every 10th line ("Lines every 10 beads"); **background bead** per chart (section 6, pulled forward from milestone 5); **marquee selection** done (Select tool; copy, paste, fill, erase, deselect; outline follows the beads; `src/selection.js`, `src/selection-controls.js`). Paste floats with a Cancel/Done bar; ⌘Z while pasting cancels the paste; the copy stays when you open another chart. Snapping is worked out from each stitch's `cellOffset` (no separate setting in the modules).
  - Step 3 done: **chart switcher**. The name box stays (type to rename); a ▾ menu next to it (Basecoat dropdown) lists the 8 most recent charts (✓ on the open one) plus New chart, Rename, Duplicate, Delete…, All charts… (`src/chart-menu.js`). The separate New chart button is gone.
  - Step 4a done: **My stash is a Basecoat dialog** over the chart (Stash in the top bar, Edit my stash in the palette; full screen on a phone), and the add/edit/delete colour forms are Basecoat dialogs. `#stash` is no longer a view. Old stash/form styles removed from `style.css`; new ones in `layout.css`.
  - Step 4b done: **Photo to chart** and **Pick colour from photo** are Basecoat dialogs (sliders use Basecoat's `range` script; full screen on a phone). No v1 dialogs are left; only the My charts and Calibration pages still use the v1 styles.
  - **Milestone 3 done** (desktop). Next: milestone 4, phone/tablet layout.

## Open questions
- **Peyote even/odd count:** is it just whether the column count is even or odd? If so, work it out from `cols` instead of a separate `peyoteCount` setting. Needed by milestone 8 (working mode).
- **Two-drop brick pick-up order** (milestone 8): assumed the top bead of each stacked pair is picked up first.
