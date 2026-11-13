// Counting and swapping a colour in a chart, including its background bead.
// Used for the open chart (chart.js) and the saved ones (storage.js).
//
// The background bead is the colour every empty bead is stitched in
// (chart.backgroundBead, null = no background bead). So if a colour is the
// background, every empty bead counts as one bead of it.

export function countBeadsOf(chart, colorId) {
  let count = 0;
  for (const row of chart.beads) {
    for (const bead of row) {
      if (bead === colorId || (bead === null && chart.backgroundBead === colorId)) count++;
    }
  }
  return count;
}

// Changes the chart in place: every oldId bead (and the background) becomes newId.
export function replaceColorIn(chart, oldId, newId) {
  for (const row of chart.beads) {
    row.forEach((bead, col) => {
      if (bead === oldId) row[col] = newId;
    });
  }
  if (chart.backgroundBead === oldId) chart.backgroundBead = newId;
}
