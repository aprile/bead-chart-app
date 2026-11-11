# Bead Chart App — Plan

## Goal
A personal web app for designing bead charts for jewelry: paint beads by hand, use real Miyuki bead colors, and turn a photo into a chart, all sized to exact final measurements.

## Decisions so far
- **Users:** just me. Runs locally in the browser. No accounts, no server.
- **Stitches:** loom (straight grid) and brick stitch (every other row shifted half a bead).
- **Beads:** Miyuki Round Rocailles, in **11/0** or **15/0** (chosen per chart).
- **Sizing:** charts are set up by final size (width × height in mm or cm), rectangles and squares only. The app calculates how many beads that needs. **For brick stitch, the width includes the half-bead overhang** of the offset rows.
- **Colors:** the full Miyuki round rocaille color list is built into the app. I tick the colors I own ("my stash"), and charts and photo import only use stash colors.
- **Custom colors:** I can add my own colors in the app with a name, a screen color and the size(s) they come in.
- **Photo import:** the user can cap the number of colors.
- **Tech:** Vite + plain JavaScript, HTML/CSS for the interface, `<canvas>` for the chart. No framework for now.
- **Code:** Git + GitHub repo `bead-chart-app`.

## Bead sizes (starting values)
From published Miyuki specs. Round rocailles are slightly flattened: the **diameter** is across the bead, and the **thickness** is the length along the hole.

| Size | Diameter | Thickness (along hole) |
|---|---|---|
| 11/0 | ~2.0 mm | ~1.36 mm |
| 15/0 | ~1.5 mm | ~1.0–1.2 mm (use 1.1 mm) |

The spacing depends on the stitch, because the bead faces a different way:
- **Loom:** holes run horizontally. Column width ≈ thickness, row height ≈ diameter.
- **Brick stitch:** holes run vertically. Column width ≈ diameter, row height ≈ thickness.

Finished beadwork usually comes out a bit bigger than the specs because of thread and tension. So the app will have a **calibration setting**: measure a sample I've made (e.g. "10 beads = 21 mm") and use that instead of the default values.

### Size calculation
- **Loom:** columns = width ÷ column width, rows = height ÷ row height (rounded to whole beads).
- **Brick stitch (overhang included):** the offset rows add half a bead, so total width = (columns + 0.5) × bead width. Columns = (width ÷ bead width) − 0.5, rounded.
- Always at least 1 column and 1 row.
- After rounding, the app always shows the real finished size.

**Examples (11/0, spec values):**
- Loom bracelet 2 × 18 cm → 15 beads across × 90 rows ≈ 2.04 × 18 cm
- Brick stitch earring 3 × 3 cm → 15 beads across (≈ 3.1 cm incl. overhang) × 22 rows ≈ 3.0 cm

## Color list
- Miyuki doesn't publish one official list with names and screen colors. Color **codes** are official and shared across sizes (e.g. 401 = opaque black), but **names come from distributors** and differ between shops, and there are **no official hex values**.
- `src/data/miyuki-colors.json` was collected on 2026-11-11 from miyukiwholesale.com (all 11/0 and 15/0 single-colour seed beads) plus the extra colours Perles & Co has. Mixes and sets were left out.
  - **622 colours:** 546 in 11/0, 349 in 15/0, 273 in both.
  - File shape: `{ about, count, colors: [...] }`. Each colour: `id`, `code`, `name`, `family` (e.g. blue, gold), `finish` (array, e.g. ["silver lined", "matte"]), `sizes` (e.g. ["11/0", "15/0"]), `hex`, `hexApprox`, `sources`.
  - **Screen colours are rough guesses** from the colour words in each name (`hexApprox: true`). Good enough to browse and pick a stash, not for accurate photo matching.
- **Every color's screen value can be edited**, including setting it by picking from a photo of my own bead tube. Store these as overrides; never change the JSON file.
- **Stash screen:** search by code or name, filter by size, colour family and finish, tick "in my stash".

### Custom colors
- An **"Add color"** form on the stash screen with:
  - **Name** (required), e.g. "Grandma's teal"
  - **Screen color:** a color picker, or pick from a photo of the bead
  - **Size(s):** 11/0, 15/0, or both (at least one)
  - **Code** (optional), e.g. a Miyuki code missing from the list, or another brand's code
  - **Notes** (optional), e.g. brand, where I bought it
- New custom colors go straight into my stash.
- Custom colors are **saved separately from the built-in list** with their own IDs (e.g. `custom-1`), so updating the Miyuki list never overwrites or clashes with them.
- I can **edit or delete** them. If a color is used in a chart, deleting it asks first and suggests a replacement color for those beads.
- They show up in search with a "custom" label, and are included in the backup file.
- They use the same bead dimensions as the chosen size (11/0 or 15/0).

## Version 1 scope
1. **New chart:** choose the stitch, bead size (11/0 or 15/0) and final width × height. The app calculates the bead count and shows the real finished size after rounding.
2. **Chart grid:** draw it on a canvas with bead proportions that match the real bead and stitch. Brick rows are offset.
3. **Hand painting:** click or drag to paint, eraser, undo/redo.
4. **Colors + stash:** the full Miyuki list, custom colors, a stash screen, and a palette showing only stash colors that come in the chart's bead size.
5. **Photo to chart:** upload an image, crop/scale it to the chart size, set a **max number of colors**, then pick the best colors from the stash (custom ones included) and match each bead to its nearest color. Then edit by hand.
6. **Save:** save charts, stash and custom colors automatically in the browser (localStorage), plus export/import a file (.json) as a backup.

## Not in version 1
- Peyote stitch
- Shapes other than rectangles/squares
- Printable chart / bead count per color (likely the first thing to add after v1)
- Accounts, hosting, sharing

## Data shape (rough)
- **Built-in color:** `{ id: "miyuki-401", code: "401", name, family, finish: ["opaque"], sizes: ["11/0", "15/0"], hex, hexApprox, sources }`
- **Custom color:** `{ id: "custom-1", code?: "...", name, sizes: ["11/0"], hex, notes?, custom: true }`
- **Stash:** `{ "11/0": [ids...], "15/0": [ids...] }`, plus any hex overrides I set on built-in colors
- **Chart:** `{ name, stitch: "loom" | "brick", beadSize: "11/0" | "15/0", widthMm, heightMm, cols, rows, beads: [[color id or null, ...], ...] }`
- **Calibration:** `{ beadSize, stitch, mmPerColumn, mmPerRow }`

## Build order (milestones)
1. [x] New-chart panel: measurements → bead count, with the real finished size shown (overhang included for brick)
2. [x] Grid drawing for loom and brick, with correct bead proportions
3. [x] Painting + eraser + undo
4. [x] Load `miyuki-colors.json` + stash screen + stash-only palette + add/edit/delete custom colors
5. [x] Save/load (localStorage + JSON file)
6. [x] Photo import + color cap + color matching
7. [x] Polish: zoom, grid lines toggle, calibration screen, edit color from bead photo, rename/duplicate charts

## Progress
- **Milestones 1–6 done.** Beyond the plan, they also added: a "My charts" screen, autosave, a backup check before import, a "missing colour" look for deleted colours, and in photo import a debug view of the sampled colours, dominant-colour sampling, lock/swap for the chosen colours, brightness/contrast/saturation, and background removal.
- **Milestone 7 done.** Zoom (buttons, fit to screen, Cmd + scroll / pinch), loom grid lines with every 10th line marked, row and column numbers counted from the bottom left, view settings remembered, a calibration screen (my measurements replace the spec per bead size + stitch; saved charts keep their bead counts and are included in the backup), and picking a colour from a bead photo. Rename/duplicate charts were done in milestone 5.
- **Version 1 is complete.** Next candidates from "Not in version 1": a printable chart and a bead count per colour.
