# Bead Chart App — Version 2 Plan

Builds on `PLAN.md` (v1). Everything there still applies unless this doc changes it.

## v2 goals
1. **More stitches:** square stitch, flat peyote (even and odd count), and two-drop brick stitch (two rows at a time).
2. **New layout:** big canvas in the middle with collapsible side panels. **It also has to work on a phone or tablet.**
3. **Design polish** with **Basecoat**, the shadcn/ui design system without React.
4. **Single-file export/import:** one chart as `.json`, and a chart picture as `.png`. The full backup stays as it is.
5. **Working mode:** switch between drawing and working. In working mode I mark the row I'm on (row only, no bead marker; changed 2026-11-17).
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

- **Peyote even/odd count** is worked out from the number of columns (decided 2026-11-17, no separate setting). It doesn't change the drawing, only how the row ends work, so working mode shows the right turn at the end of each row.
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

**Row only** (decided 2026-11-17): working mode tracks **which row I'm on**, not the bead within it. No bead marker.

**On the canvas**
- Work **always starts at the bottom row** and goes up.
- The **current row** is highlighted, with a small arrow showing which way the row goes. Rows below it are done and dimmed; rows still to do stay normal.
- Tapping any bead makes its row the current row.
- The canvas scrolls by itself to keep the current row in view.
- **Two-drop brick:** a working row is a pair of chart rows. The row indicator sits on the **top row** of the pair.
- **Peyote:** a working row is a zig-zag row (every other bead); rows 1 and 2 are picked up together.

**Progress panel** (left panel on desktop, bottom panel on phone)
- "Row 12 of 90"
- **The current row written out in pick-up order**, grouped by colour: e.g. `3 × 401 Black · 2 × 4201 Duracoat Silver · 5 × 401 Black`. On two-drop brick each stack is top bead first.
- Buttons: **next row / previous row**.
- **On a phone:** a large "next row" button at thumb height, with "previous row" smaller next to it. Swiping on the panel also moves row by row.
- Keyboard on desktop: up/down arrows for row, space for next row.
- For peyote it shows the turn at the row end for even or odd count (from the number of columns).
- **Keep screen on** while in working mode (on browsers that support it), so the phone doesn't lock mid-row.

**Saving**
- Progress is saved **per chart** (the current row) and comes back when I reopen the chart.
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
    stitch: "loom" | "square" | "brick" | "brick2" | "peyote" | "peyote2",
    beadSize, widthMm, heightMm, cols, rows,
    beads: [[colorId | null, ...], ...],
    backgroundBead: colorId | null,       // was `background: "#f5f1ea"` (never used); upgraded on load
    progress?: { row }                    // row = current working row (0 = first), counted in the stitch's working rows (two-drop: pairs)
  }
  ```
- **Single chart file:** `{ type: "bead-chart", version: 2, chart, customColors: [...], hexOverrides: { id: hex } }`
- **Calibration:** keyed by stitch and bead size.
- **Migration:** when the app loads v1 data (localStorage or an imported file), it adds `version: 2`, no background bead (`backgroundBead: null`) and no progress. Nothing else changes, so v1 charts open as they were.

## Build order (milestones)
1. **Stitch modules:** move loom and brick into modules with no visible change, and add `version` + migration. Check v1 charts look identical.
2. **New stitches:** square, then two-drop brick, then peyote (the trickiest because of the vertical offset and zig-zag rows).
3. **Tailwind + Basecoat + new layout:** install, pick a theme, the canvas-first shell, side panels, chart switcher, dialogs for stash and photo import.
4. *(Postponed 2026-11-13, do after milestone 9 or in v3)* **Phone/tablet layout:** bottom panel, touch gestures (pinch zoom, pan, paint), bigger touch targets. Test on a real phone with `npm run dev -- --host`.
5. ~~Background colour~~ (done early as the background bead, see section 6).
6. **Single chart export/import** (.json), including the custom colour merge rules and the share sheet.
7. **PNG export** with the optional colour key.
8. **Working mode:** switch, current-row highlight, progress panel, phone controls, keyboard shortcuts, keep screen on, saved progress, peyote and two-drop rows.
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
  - **Milestone 3 done** (desktop).
  - Added 2026-11-13 (asked for before milestone 4): **turn sideways** button in the zoom controls. View only: the chart is drawn a quarter turn clockwise (row 1 on the left, rows running left to right, column 1 at the top); the beads, stitch and export don't change. Remembered per chart (`view.sideways` in the view settings). `grid.js` draws in chart space and turns it with one canvas transform; pointer positions are turned back, so painting, fill, selection and paste work unchanged. Numbers stay upright. The side numbers (columns) count from the **bottom** of the screen when sideways, so numbering still starts bottom-left (decided 2026-11-13; the picture isn't mirrored, so column 1 is labelled with the column count); the 10-bead column lines follow.
  - Fixed 2026-11-13: **resizing keeps the bottom-left corner** (row 1, column 1) instead of the top left, since work starts there. Rows and columns are added or cut at the top and right. On stitches with offsets, if keeping the corner would change the design's shape (brick with an odd change in rows, peyote with an odd change in columns), the design moves by one row/column to the nearest position that keeps the shape and cuts the fewest painted beads (`resizedPosition` in `chart.js`, using the paste shape check). Also fixed the shape check for pieces hanging off the chart's edge. **Turned sideways** (fixed 2026-11-17), new beads still appear at the top and right **of the screen**: columns are added or cut on the chart's left (the screen's top), keeping the bottom-right corner (the screen's bottom left) (`growLeft` in `resizeChart`).
  - **Milestone 4 (phone/tablet) postponed** (2026-11-13): desktop first. The dialogs already go full screen on a phone. Milestone 5 (background) was done early as the background bead.
  - **Milestone 6 done** (desktop): Export chart… / Import chart… in the charts menu (`src/chart-file.js`, `src/chart-import.js`). The file holds the chart, the custom colours it uses (incl. the background bead) and my screen-colour edits for the Miyuki colours it uses. Import always adds a new chart ("Name (2)" if taken); custom colours are matched by name + screen colour, otherwise added (and put in the stash); **screen-colour edits: mine win** (decided 2026-11-13), the file's are only used where I have none; Miyuki colours missing from the stash are offered in a dialog. The phone share sheet waits for the phone milestone.
  - **Milestone 7 done**: Export picture… in the charts menu (`src/picture-export.js` draws, `src/picture-dialog.js` is the dialog with a live preview). Options: bead size (6–64 px, shorter side), lines every 10 beads, colour key with bead counts (most-used first; empty beads count as the background bead), transparent background (empty beads left out), turned sideways (starts as the chart is shown). Options are remembered (`pictureExport`). Very big pictures get smaller beads automatically (max 16000 px a side).
  - Added 2026-11-13: **photo import switch "Only colours in my stash"** (on by default). Off: the photo may use every colour made in the chart's bead size (Miyuki + custom); Swap menus show My stash, then Other colours. With no stash colours in that size the photo import still opens, with the switch off. After Apply, colours not in the stash are offered in the "Add these colours to your stash?" dialog (now shared: `src/stash-offer.js`, also used by chart import).
  - Added 2026-11-13: **palette "My stash | All colours"** (remembered, `palette` key). All colours = every colour made in the chart's bead size, colour-family order, a ✓ badge on the ones in my stash, a search box, and "Add to my stash" under a chosen colour that isn't in it. The picker on a colour outside my stash switches the palette to All colours.
  - All colours is in **foldable sections by finish** (a colour's first finish; my custom colours first as "My colours"), each with its count and how many are in my stash. Folded sections are remembered; a search opens the sections with matches. **My stash** (palette) and the **My stash dialog** list colours in one list **by colour code** as a number (1, 2, 4, 10, 401…), my custom colours mixed in by their code: no code first (by name), then number codes (a Miyuki colour before mine with the same code), then letter codes A–Z (changed 2026-11-23; `sortByCode` in `colors.js`; family sections were tried and dropped). The dialog's Colour family filter is A–Z.
  - Added 2026-11-22: **edit a colour's family** in the stash. Miyuki colours: a Colour family choice in the Edit colour dialog (A–Z, the Miyuki one marked); my changes are saved separately as `familyOverrides` (`{ id: family }`, like `colorOverrides`; in backups, and an older backup without it is fine). Choosing the Miyuki family again removes the change; the "edited" badge shows for either change. Custom colours: an optional `family` in their form ("None" = under My colours); with one, they're found by the Colour family filter and sort with that family where colours are in family order (All colours, photo import). Chart files carry a custom colour's family. The stash list's grey line shows the family. **Tooltips** with the colour name after ~0.4 s on hover (`src/tooltip.js`, shared label placed on the page so the panel doesn't cut it off).
  - **Milestone 8 in progress** (working mode).
    - Step 1 done: **Draw / Work switch** in the top bar (`src/work-mode.js`, remembered as `mode`). Work turns painting off (clicks/drags on the canvas, ⌘Z/⇧⌘Z, copy/paste/delete keys), drops any selection or paste, and swaps the left panel's tools for a Progress section (`.draw-only` / `.work-only`, via `data-mode` on `#app`). The Chart tab's settings (stitch, size, background bead) are locked while working (a disabled `<fieldset id="chart-settings">`); the View switches and the palette still work.
    - Step 2 done: **current row**. Each stitch module now has `workRows(cols, rows)` (replaces `readingOrder`): the rows as they're worked, from the bottom, each `{ beads (pick-up order), label, last }`. Two-drop brick: one working row = a pair ("Rows 1 & 2"), top bead first. Peyote: "Rows 1 & 2" (the bottom chart row), then each zig-zag row ("Row 3", …), so the total is peyote rows (2 × chart rows). In work mode the finished rows are faded, the current row has an orange outline (both rows of a two-drop pair), and clicking a bead jumps to its row. Progress panel (`src/progress.js`): "Rows 1 & 2 of 90", which way the row runs on screen (arrow + words, follows the sideways view), Next row / Previous row. Saved as `chart.progress = { row }` (index into `workRows`; not part of undo; a row past the end after a resize shows as the last row). The chart view takes several overlays now (`addOverlay`).
    - Step 3 done: **the row's colours** under the buttons ("Pick up, in order": `3 × ● 401 Black`, consecutive beads of one colour grouped; empty beads count as the background bead) and **keys**: ↑ / → / space = next row, ↓ / ← = previous row (not while typing or in a dialog).
    - Step 4 done: **the chart scrolls to the current row** when it isn't in view (next/previous row, keys, switching to Work, opening a chart, turning sideways); a row that fits is put in the middle, a row longer than the screen only scrolls when none of it shows (`scrollToShow` in `chart-view.js`, `beadsBox` in `grid.js`). **Start again** button (asks first) goes back to the first row.
    - Next: peyote turn at the row ends, keep screen on.
  - Added 2026-11-22: **two-drop peyote** (`src/stitches/peyote2.js`, id `peyote2`). Like flat peyote with pairs of columns: the two columns of a pair sit level, each pair shifted ½ bead from the next. Pairs counted from the right; the rightmost pair is low (as in flat peyote); with an odd number of columns the leftmost pair is a single column. Working rows: "Rows 1 & 2" = the bottom chart row, left to right; then each zig-zag row is every other pair (odd rows: low pairs, right to left; even rows: high pairs, left to right), two beads per stitch in the direction of travel. Height includes the ½-bead overhang. Starts from the flat peyote calibration.
  - Changed 2026-11-17 (asked for during milestone 8):
    - **Changing the bead size keeps the columns and rows** (the design stays the same); only the finished size changes (`new-chart-panel.js`). Changing the stitch still keeps whichever box I typed in last.
    - **Photo import chooses the chart size**: a Size section (Columns, Rows) in the photo dialog, starting at the chart's size. "Keep the box's shape" (on): the other count follows, so the crop box keeps its shape; off: the box changes shape (same area and middle). Apply changes the chart to that size, with the finished size following, in the same undo step as the beads (`setAllBeads` takes the size from the beads).
  - Added 2026-11-21: **photo import follows grid lines** in the picture (a chart saved as an image, pixel art). `src/grid-detect.js` looks for evenly spaced lines when the picture loads. If it finds them, a switch "Follow the grid in the picture" (on) appears under Size: the box fits the whole grid, the size becomes its squares, the box snaps to whole squares (move and corners, any shape), and the size follows the box's squares. Each square becomes one bead, with no stitch offsets (`plainGrid` in `sampleBeadColors`). "Keep the box's shape" is off while following the grid. Switch off = the normal photo box. Only straight grids are recognised (agreed 2026-11-21: that's enough).
  - Added 2026-11-21: **stretch to the beads' shape** (grid pictures; switch on by default). Square squares come out squashed in beads that aren't square, so some columns (loom: narrow beads) or rows (brick: wide beads) are repeated, spread evenly, like adding columns in between by hand: beads = squares × (square width ÷ height) × (row height ÷ column width), only ever adding beads (`beadStretch` in `photo.js`). Each square is sampled once, then repeated (`stretchColors` in `photo-sampling.js`), so colours stay crisp. Typing Columns/Rows on the grid sets my own stretch (beads per square; the box stays), and the switch turns off unless it matches. Switch off = one bead per square.
  - Added 2026-11-21: **any-shape box** for photos: with "Keep the box's shape" off, dragging a corner changes the box's shape freely; the columns stay and the rows follow the box. Turning the switch back on gives the box the chart's shape again.
  - Added 2026-11-21: **picture under the beads**. Apply in the photo import keeps the part of the picture in the box with the chart (`src/chart-picture.js`; a JPEG, max 1600 px, in its own key `bead-chart-app.picture.<id>`, not in backups or chart files; deleted with the chart, copied by Duplicate, kept when restoring a backup that has the chart). Chart tab → View: **Picture under beads** switch and **Bead opacity** (10–100 %, default 50 %), both remembered (`view.picture`, `view.beadOpacity`), plus **Remove picture**. The picture is drawn from the chart's bottom-left corner, `across × down` beads in size (the grid's squares, or the chart's real shape incl. overhang). Not part of undo. Works in Draw and Work mode.

## Open questions
- ~~**Peyote even/odd count**~~ (answered 2026-11-17): yes, it's whether the column count is even or odd. Worked out from `cols`; no `peyoteCount` setting.
- ~~**Two-drop brick pick-up order**~~ (answered 2026-11-17): the **top bead of each stacked pair goes on the needle first** (as `brick2.js` already has it). In working mode the row indicator for a pair sits on the **top row** of the pair.
