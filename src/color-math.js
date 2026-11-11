// How different two colours look.
// RGB distance doesn't match what eyes see very well, so we convert to
// "Lab", a colour space designed so that equal distances look equally different.

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// Screen value (0–255) → linear light (0–1), worked out once for all 256
// values, because photo import converts hundreds of thousands of pixels.
const LINEAR = Array.from({ length: 256 }, (_, v) => {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
});

export function rgbToLab([r, g, b]) {
  // 1. Screen RGB (0–255) → linear light (0–1)
  const lr = LINEAR[r];
  const lg = LINEAR[g];
  const lb = LINEAR[b];
  // 2. Linear RGB → XYZ (standard daylight white)
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;
  // 3. XYZ → Lab
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function colorDifference(hexA, hexB) {
  const a = rgbToLab(hexToRgb(hexA));
  const b = rgbToLab(hexToRgb(hexB));
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// The colour in `colors` that looks most like `hex` (or undefined if the list is empty).
export function nearestColor(hex, colors) {
  let best;
  let bestDifference = Infinity;
  for (const color of colors) {
    const difference = colorDifference(hex, color.hex);
    if (difference < bestDifference) {
      best = color;
      bestDifference = difference;
    }
  }
  return best;
}
