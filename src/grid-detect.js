// Finds a grid of squares in a picture (e.g. a chart saved as an image, or
// pixel art), so each square can become exactly one bead.
//
// How it works, for each direction:
// 1. Add up how much the colour changes from one pixel to the next, down
//    each column of pixels (for the up-and-down lines) or along each row
//    (for the sideways lines). Grid lines give a tall peak at every line.
// 2. Find the spacing that repeats best (the peaks line up with a copy of
//    themselves shifted by one square).
// 3. Fine-tune the spacing to a fraction of a pixel, and find where the lines start.
// 4. Find where the grid begins and ends (titles or numbers around it don't count).
//
// The result: { x: lines, y: lines }, where lines = { start, pitch, count }:
// the first line's position in photo pixels, the distance between lines,
// and how many squares the grid has in that direction. Or null if no grid.

const CLIP = 64; // a big colour change counts no more than this, so one bold edge can't win alone
const MIN_PITCH = 4; // squares smaller than this many pixels aren't looked for
const MIN_SQUARES = 3; // a grid needs at least this many squares each way
const MIN_CONTRAST = 3; // lines must be this many times stronger than the middle of the squares

export function findGrid(photo) {
  const { width, height } = photo;
  const pixels = photo.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data;

  // First look at the whole picture…
  let across = findLines(profile(pixels, width, height, 'x', 0, height));
  let down = findLines(profile(pixels, width, height, 'y', 0, width));
  if (!across || !down) return null;

  // …then look again only inside the grid we found, so the parts around it
  // (a title, row numbers) don't blur the lines.
  const rangeOf = (lines, size) => [
    Math.max(0, Math.floor(lines.start)),
    Math.min(size, Math.ceil(lines.start + lines.count * lines.pitch)),
  ];
  const [top, bottom] = rangeOf(down, height);
  const [left, right] = rangeOf(across, width);
  across = findLines(profile(pixels, width, height, 'x', top, bottom)) ?? across;
  down = findLines(profile(pixels, width, height, 'y', left, right)) ?? down;
  return { x: across, y: down };
}

// How strongly the colour changes at each pixel position along one direction.
// axis 'x': for each x, add up the change from pixel x to x + 1, for the rows
// from..to (finds up-and-down lines). axis 'y': the same sideways.
// Then each value is added to its neighbours, so a line up to 3 pixels thick
// gives one peak in its middle.
function profile(pixels, width, height, axis, from, to) {
  const length = axis === 'x' ? width : height;
  const edges = new Float32Array(length); // edges[i] = change between pixel i and i + 1
  const step = axis === 'x' ? 4 : width * 4; // from one pixel to the next along the axis
  for (let i = 0; i < length - 1; i++) {
    let sum = 0;
    for (let j = from; j < to; j++) {
      const p = axis === 'x' ? (j * width + i) * 4 : (i * width + j) * 4;
      const q = p + step;
      // The biggest change in red, green or blue, so coloured lines count too.
      const change = Math.max(
        Math.abs(pixels[q] - pixels[p]),
        Math.abs(pixels[q + 1] - pixels[p + 1]),
        Math.abs(pixels[q + 2] - pixels[p + 2]),
      );
      sum += change < CLIP ? change : CLIP;
    }
    edges[i] = sum;
  }
  // A thin line at pixel c changes colour on both sides (edges c − 1 and c),
  // so adding those two gives a peak right on pixel c.
  const result = new Float32Array(length);
  for (let i = 0; i < length; i++) result[i] = (i > 0 ? edges[i - 1] : 0) + edges[i];
  return result;
}

// Find evenly spaced peaks in a profile. Returns { start, pitch, count } or null.
function findLines(values) {
  const n = values.length;
  const maxPitch = Math.floor(n / MIN_SQUARES);
  if (maxPitch <= MIN_PITCH) return null;

  // A slightly blurred copy, so thick lines and tiny wobbles still line up.
  const soft = new Float32Array(n);
  for (let i = 0; i < n; i++) soft[i] = (values[i - 1] ?? 0) + values[i] + (values[i + 1] ?? 0);

  // 1. Rough spacing: how well the profile matches itself shifted by `shift` pixels.
  let mean = 0;
  for (const v of soft) mean += v;
  mean /= n;
  const centred = soft.map((v) => v - mean);
  const match = new Float32Array(maxPitch + 2);
  for (let shift = MIN_PITCH - 1; shift <= maxPitch + 1; shift++) {
    let sum = 0;
    for (let i = 0; i + shift < n; i++) sum += centred[i] * centred[i + shift];
    match[shift] = sum / (n - shift);
  }
  let best = 0;
  for (let shift = MIN_PITCH; shift <= maxPitch; shift++) {
    const isPeak = match[shift] >= match[shift - 1] && match[shift] >= match[shift + 1];
    if (isPeak && (best === 0 || match[shift] > match[best])) best = shift;
  }
  if (best === 0 || match[best] <= 0) return null;

  // Charts often have a bold line every 10 squares, which can match even
  // better. If a fraction of the spacing (½, ⅓ … ¹⁄₁₂) also matches well, that's the real square.
  // (It must be a real repeat: a better match than the spacings either side of it.)
  const isPeakAt = (i) => match[i] >= match[i - 1] && match[i] >= match[i + 1];
  for (let parts = 12; parts >= 2; parts--) {
    const smaller = best / parts;
    if (smaller < MIN_PITCH) continue;
    const candidates = [Math.floor(smaller) - 1, Math.floor(smaller), Math.ceil(smaller), Math.ceil(smaller) + 1]
      .filter((i) => i >= MIN_PITCH && isPeakAt(i) && match[i] >= 0.5 * match[best]);
    if (candidates.length > 0) {
      best = candidates.reduce((a, b) => (match[b] > match[a] ? b : a));
      break;
    }
  }

  // 2. Closer spacing: try spacings a little either side of it (to 0.02 px),
  // and every starting point, and keep the "comb" that lands on the most line.
  const softAt = (x) => {
    const i = Math.floor(x);
    if (i < 0 || i >= n - 1) return 0;
    return soft[i] + (soft[i + 1] - soft[i]) * (x - i);
  };
  let pitch = best;
  let phase = 0;
  let bestScore = -1;
  for (let p = Math.max(MIN_PITCH, best - 1.5); p <= best + 1.5; p += 0.02) {
    for (let ph = 0; ph < p; ph += 0.25) {
      let sum = 0;
      let teeth = 0;
      for (let x = ph; x < n; x += p) {
        sum += softAt(x);
        teeth++;
      }
      if (sum / teeth > bestScore) {
        bestScore = sum / teeth;
        pitch = p;
        phase = ph;
      }
    }
  }

  // 3. Exact lines: find the real peak near each tooth of the comb, then fit
  // the straight line "position = start + k × pitch" through the strong ones.
  const near = Math.max(1, Math.round(pitch * 0.2));
  const findTeeth = () => {
    const teeth = [];
    // One extra tooth each side, in case a line sits right on the picture's edge.
    for (let k = -1; phase + k * pitch < n + 1; k++) {
      const guess = phase + k * pitch;
      let at = -1;
      let top = 0;
      for (let i = Math.round(guess) - near; i <= Math.round(guess) + near; i++) {
        if (i >= 0 && i < n && values[i] > top) {
          top = values[i];
          at = i;
        }
      }
      teeth.push({ k, guess, at, strength: top });
    }
    return teeth;
  };
  let teeth = findTeeth();
  const strongLimit = (list) => {
    const sorted = list.map((t) => t.strength).sort((a, b) => a - b);
    return 0.3 * sorted[Math.floor(sorted.length * 0.9)];
  };
  for (let round = 0; round < 2; round++) {
    const limit = strongLimit(teeth);
    const fit = teeth.filter((t) => t.at >= 0 && t.strength >= limit);
    if (fit.length < 3) return null;
    // Least squares: the best straight line through (k, position).
    let sk = 0, sx = 0, skk = 0, skx = 0;
    for (const t of fit) {
      sk += t.k;
      sx += t.at;
      skk += t.k * t.k;
      skx += t.k * t.at;
    }
    const m = fit.length;
    pitch = (m * skx - sk * sx) / (m * skk - sk * sk);
    phase = (sx - pitch * sk) / m;
    if (!(pitch >= MIN_PITCH)) return null;
    teeth = findTeeth();
  }

  // 4. Where the grid begins and ends: the first and last strong line.
  // A line just outside the picture counts as strong (pixel art often
  // has no line on its outer edge).
  const limit = strongLimit(teeth);
  const isStrong = (t) => t.strength >= limit || t.guess < 1.5 || t.guess > n - 2.5;
  let first = teeth.findIndex((t) => t.strength >= limit);
  let last = teeth.length - 1;
  while (last > first && teeth[last].strength < limit) last--;
  if (first < 0) return null;
  while (first > 0 && isStrong(teeth[first - 1]) && teeth[first - 1].guess > -1.5) first--;
  while (last < teeth.length - 1 && isStrong(teeth[last + 1]) && teeth[last + 1].guess < n + 0.5) last++;
  const count = last - first;
  if (count < MIN_SQUARES) return null;

  // Most lines inside the grid should be strong (pixel art without lines can
  // miss a few, where neighbouring squares have the same colour)…
  let strongInside = 0;
  for (let i = first; i <= last; i++) if (isStrong(teeth[i])) strongInside++;
  if (strongInside < 0.6 * (count + 1)) return null;

  // …and much stronger than the middle of the squares. A normal photo fails here.
  let lineSum = 0;
  let middleSum = 0;
  for (let i = first; i < last; i++) {
    lineSum += teeth[i].strength;
    middleSum += values[Math.min(n - 1, Math.max(0, Math.round(teeth[i].guess + pitch / 2)))];
  }
  if (lineSum < MIN_CONTRAST * Math.max(middleSum, 1)) return null;

  // + 0.5: a peak on pixel i means the line's middle is at i + 0.5.
  return { start: teeth[first].guess + 0.5, pitch, count };
}
