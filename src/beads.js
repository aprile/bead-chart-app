// Bead dimensions, in millimetres. This is the ONE place they live.
// Values are the published Miyuki specs from PLAN.md.
// Later, the calibration setting will be able to override these.
//
// diameter  = across the bead
// thickness = length along the hole
export const BEAD_SIZES = {
  '11/0': { diameter: 2.0, thickness: 1.36 },
  '15/0': { diameter: 1.5, thickness: 1.1 },
};
