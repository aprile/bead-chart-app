// Finds a grid of squares in a picture (e.g. a chart saved as an image, or a
// photo or scan of a printed chart), so each square can become exactly one bead.
//
// How it works, for each direction:
// 1. If the picture was enlarged (every pixel copied into a block of about
//    2 × 2, 4 × 4…), shrink it back first, so the lines aren't stuck to the blocks.
// 2. Look for thin lines: pixels darker than the pixels a few
//    steps to either side. Add these up along each column of pixels (for the
//    up-and-down lines) or each row (for the sideways ones). Grid lines give a
//    peak at every line; the pattern inside the squares mostly averages out.
//    This is done in strips, because a photo of a chart is often slightly
//    tilted or curved: over a short strip, the lines still line up.
// 3. Find the spacing that repeats (the strips are compared with a shifted
//    copy of themselves). Bold lines every 10 squares, or big shapes in the
//    design, repeat too, so we take the SMALLEST spacing whose lines are real.
// 4. Fine-tune the spacing to a fraction of a pixel, and find where the grid
//    begins and ends (paper or a title around it doesn't count).
//
// The result: { x: lines, y: lines }, where lines = { start, pitch, count }:
// the first line's position in photo pixels, the distance between lines,
// and how many squares the grid has in that direction. Or null if no grid.

const MIN_PITCH = 4; // squares smaller than this many pixels aren't looked for
const MIN_SQUARES = 3; // a grid needs at least this many squares each way
const REACH = 3; // a line pixel is compared with the pixels this far to each side
const CLIP = 64; // a big difference counts no more than this, so one bold mark can't win alone
const STRIP = 150; // about how many pixels wide each strip is
const MIN_REPEAT = 0.15; // how well the strips must match themselves, shifted by one square (0–1)
// Share of the comb's teeth that must land on a line. Real squares score about
// 0.7–1; half-size squares about 0.5–0.6 (half their teeth are mid-square).
const MIN_ON_LINES = 0.65;

export function findGrid(photo) {
  const { width, height } = photo;
  const pixels = photo.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data;
  const grey = new Float32Array(width * height);
  for (let p = 0; p < grey.length; p++) {
    grey[p] = 0.299 * pixels[p * 4] + 0.587 * pixels[p * 4 + 1] + 0.114 * pixels[p * 4 + 2];
  }

  // 1. Undo any enlarging, separately for each direction.
  const bx = enlargedBlocks(grey, width, height, 'x');
  const by = enlargedBlocks(grey, width, height, 'y');
  const small = shrink(grey, width, height, bx, by);

  const across = findLines(small, 'x');
  const down = findLines(small, 'y');
  if (!across || !down) return null;

  // Back to the photo's own pixels.
  const back = (lines, blocks, size) => {
    if (!blocks) return lines;
    return { start: toPhoto(lines.start, blocks), pitch: (lines.pitch * size) / blocks.length, count: lines.count };
  };
  return { x: back(across, bx, width), y: back(down, by, height) };
}

// ---------- Enlarged pictures ----------

// Was the picture enlarged along this direction, by copying each pixel about
// 2 to 8 times (not always a whole number of times, e.g. 4, 4, 4, 5, 4…)?
// Then the colour only changes at the edges of those blocks, the same edges
// in every row. Returns the blocks [{ start, end }, …] (end not included), or
// null if it wasn't enlarged.
function enlargedBlocks(grey, width, height, axis) {
  const length = axis === 'x' ? width : height;
  const across = axis === 'x' ? height : width;
  const changes = new Float64Array(length - 1); // colour change from pixel i to i + 1
  const step = Math.max(1, Math.floor(across / 300)); // every few rows is plenty
  for (let j = 0; j < across; j += step) {
    for (let i = 0; i < length - 1; i++) {
      const a = axis === 'x' ? grey[j * width + i] : grey[i * width + j];
      const b = axis === 'x' ? grey[j * width + i + 1] : grey[(i + 1) * width + j];
      changes[i] += Math.abs(b - a);
    }
  }
  // Where the blocks meet: anywhere the colour changes at all.
  const edges = [];
  for (let i = 0; i < changes.length; i++) if (changes[i] > 0.5) edges.push(i + 1);
  if (edges.length < MIN_PITCH * MIN_SQUARES || edges.length > length / 2) return null;

  // An enlarged picture has blocks of (nearly) one size. A flat-coloured
  // digital chart has no colour changes inside its squares either, but its
  // blocks are wide squares and thin lines, so they're all sorts of sizes.
  const sizes = [];
  for (let i = 1; i < edges.length; i++) sizes.push(edges[i] - edges[i - 1]);
  const typical = [...sizes].sort((a, b) => a - b)[Math.floor(sizes.length / 2)];
  if (typical < 2 || typical > 8) return null;
  // Two blocks of the same colour side by side look like one double-size
  // block, so a size counts if it's a whole number of typical blocks.
  const fits = (size) => {
    const blocks = Math.max(1, Math.round(size / typical));
    return Math.abs(size - blocks * typical) <= blocks; // e.g. 4 or 5 for typical 4
  };
  if (sizes.filter(fits).length < 0.95 * sizes.length) return null;

  // List the blocks, splitting the double-size ones.
  const bounds = [0, ...edges, length];
  const blocks = [];
  for (let i = 1; i < bounds.length; i++) {
    const size = bounds[i] - bounds[i - 1];
    const parts = Math.max(1, Math.round(size / typical));
    for (let k = 0; k < parts; k++) {
      blocks.push({
        start: bounds[i - 1] + Math.round((k * size) / parts),
        end: bounds[i - 1] + Math.round(((k + 1) * size) / parts),
      });
    }
  }
  return blocks;
}

// Shrink the picture back: each block becomes one pixel (its middle pixel).
function shrink(grey, width, height, bx, by) {
  if (!bx && !by) return { grey, width, height };
  const middles = (blocks, size) =>
    blocks ? blocks.map((b) => Math.floor((b.start + b.end - 1) / 2)) : Array.from({ length: size }, (_, i) => i);
  const xs = middles(bx, width);
  const ys = middles(by, height);
  const out = new Float32Array(xs.length * ys.length);
  for (let y = 0; y < ys.length; y++) {
    for (let x = 0; x < xs.length; x++) out[y * xs.length + x] = grey[ys[y] * width + xs[x]];
  }
  return { grey: out, width: xs.length, height: ys.length };
}

// A position in the shrunk picture, back in the photo's pixels.
function toPhoto(position, blocks) {
  const i = Math.min(Math.max(Math.floor(position), 0), blocks.length - 1);
  const block = blocks[i];
  return block.start + (position - i) * (block.end - block.start);
}

// ---------- Finding the lines in one direction ----------

// axis 'x': the up-and-down lines (so the squares across); 'y': the sideways lines.
function findLines({ grey, width, height }, axis) {
  const length = axis === 'x' ? width : height;
  const across = axis === 'x' ? height : width;
  const maxPitch = Math.floor(length / MIN_SQUARES);
  if (maxPitch <= MIN_PITCH) return null;

  // 2. One line profile per strip.
  const stripCount = Math.min(16, Math.max(1, Math.round(across / STRIP)));
  const strips = [];
  for (let s = 0; s < stripCount; s++) {
    const from = Math.floor((s * across) / stripCount);
    const to = Math.floor(((s + 1) * across) / stripCount);
    strips.push(lineProfile(grey, width, axis, length, from, to));
  }

  // 3. How well the strips match themselves shifted by each spacing (averaged).
  const repeat = new Float64Array(maxPitch + 2);
  for (const strip of strips) {
    const r = selfMatch(strip, maxPitch + 1);
    for (let shift = 1; shift <= maxPitch + 1; shift++) repeat[shift] += r[shift] / strips.length;
  }
  let pitch = 0;
  for (let shift = MIN_PITCH; shift <= maxPitch; shift++) {
    const isPeak = repeat[shift] > repeat[shift - 1] && repeat[shift] >= repeat[shift + 1];
    if (!isPeak || repeat[shift] < MIN_REPEAT) continue;
    // Between whole pixels: the top of a curve through the three values.
    const [a, b, c] = [repeat[shift - 1], repeat[shift], repeat[shift + 1]];
    const exact = shift + (0.5 * (a - c)) / (a - 2 * b + c || 1);
    if (shareOnLines(strips, exact) >= MIN_ON_LINES) {
      pitch = exact;
      break;
    }
  }
  if (pitch === 0) return null;

  // 4a. Fine-tune the spacing: the one whose comb lands best on the lines,
  // each strip with its own starting point (so tilt doesn't matter).
  const blurred = strips.map((strip) => blur(strip, pitch));
  let bestScore = -1;
  let fine = pitch;
  for (let p = pitch - 0.5; p <= pitch + 0.5; p += 0.01) {
    let score = 0;
    for (const strip of blurred) score += bestComb(strip, p).score;
    if (score > bestScore) {
      bestScore = score;
      fine = p;
    }
  }
  pitch = fine;

  // 4b. In each strip, a line near the middle to start from. Each strip's is
  // kept within half a square of its neighbour's, so line number k is the
  // same line in every strip, even if the photo is tilted.
  const starts = blurred.map((strip) => {
    const { phase } = bestComb(strip, pitch);
    return phase + Math.round((length / 2 - phase) / pitch) * pitch;
  });
  const middle = Math.floor(starts.length / 2);
  const near = (at, target) => at + Math.round((target - at) / pitch) * pitch;
  for (let s = middle + 1; s < starts.length; s++) starts[s] = near(starts[s], starts[s - 1]);
  for (let s = middle - 1; s >= 0; s--) starts[s] = near(starts[s], starts[s + 1]);

  // 4c. Follow the lines outwards from there in each strip, then add the
  // strips up: each line's strength, and its position (the strong strips count most).
  const followed = blurred.map((strip, s) => followLines(strip, pitch, starts[s]));
  const ks = followed.flatMap((lines) => lines.map((line) => line.k));
  const teeth = [];
  for (let k = Math.min(...ks); k <= Math.max(...ks); k++) {
    let strength = 0;
    let weighted = 0;
    let plain = 0;
    let found = 0;
    for (const lines of followed) {
      const line = lines.find((l) => l.k === k);
      if (!line) continue;
      strength += line.strength;
      weighted += line.strength * line.at;
      plain += line.at;
      found++;
    }
    if (found === 0) continue;
    teeth.push({ k, strength, at: strength > 0 ? weighted / strength : plain / found });
  }

  // 4d. The grid runs from the first to the last strong line.
  const sorted = teeth.map((t) => t.strength).sort((a, b) => a - b);
  // (Bold lines every 10 squares can be several times stronger than the thin ones.)
  const strong = 0.12 * sorted[Math.floor(sorted.length * 0.9)];
  const first = teeth.findIndex((t) => t.strength >= strong);
  let last = teeth.length - 1;
  while (last > first && teeth[last].strength < strong) last--;
  const count = last - first;
  if (first < 0 || count < MIN_SQUARES) return null;
  let strongInside = 0;
  for (let i = first; i <= last; i++) if (teeth[i].strength >= strong) strongInside++;
  if (strongInside < 0.6 * (count + 1)) return null;

  // The box is one even grid from the first line to the last. + 0.5: a peak
  // on pixel i means the line's middle is at i + 0.5.
  return {
    start: teeth[first].at + 0.5,
    pitch: (teeth[last].at - teeth[first].at) / count,
    count,
  };
}

// Follow the lines in one strip, from the line at `start`, outwards both
// ways: each next line is about one square further, and is moved to the
// strongest spot nearby, so slightly uneven squares (a page that isn't flat)
// are followed. Where there's no clear line (paper around the grid), it
// carries on evenly. Returns [{ k (line number, 0 = start), at, strength }, …].
function followLines(strip, pitch, start) {
  const n = strip.length;
  const reach = Math.max(1, pitch * 0.2);
  // How strong a line at `at` is: its value above halfway to the next lines.
  const strengthAt = (at) =>
    Math.max(0, valueAt(strip, at) - (valueAt(strip, at - pitch / 2) + valueAt(strip, at + pitch / 2)) / 2);

  // A typical line in this strip, from the even comb, to tell lines from noise.
  const even = [];
  for (let at = start - Math.floor(start / pitch) * pitch; at < n; at += pitch) even.push(strengthAt(at));
  even.sort((a, b) => a - b);
  const clear = 0.25 * (even[Math.floor(even.length * 0.75)] ?? 0);

  const lines = [];
  for (const direction of [1, -1]) {
    let expected = direction === 1 ? start : start - pitch;
    let k = direction === 1 ? 0 : -1;
    while (expected > -pitch / 2 && expected < n - 1 + pitch / 2) {
      let at = expected;
      let strength = 0;
      if (expected >= 0 && expected <= n - 1) {
        // The strongest spot near where the line should be.
        let best = expected;
        let top = strengthAt(expected);
        for (let d = -reach; d <= reach; d += 0.5) {
          const value = strengthAt(expected + d);
          if (value > top) {
            top = value;
            best = expected + d;
          }
        }
        strength = top;
        if (top >= clear && clear > 0) at = best; // a clear line: follow it
      }
      lines.push({ k, at, strength });
      expected = at + direction * pitch;
      k += direction;
    }
  }
  return lines;
}

// For each pixel position along the axis: how much it looks like part of a
// thin line, added up over the strip (from..to across the axis): how much
// darker it is than the lighter of the pixels REACH steps to either side.
// (Only dark lines: on printed charts, light ones are mostly the paper's texture.)
function lineProfile(grey, width, axis, length, from, to) {
  const profile = new Float32Array(length);
  for (let j = from; j < to; j++) {
    const at = axis === 'x' ? (i) => grey[j * width + i] : (i) => grey[i * width + j];
    for (let i = REACH; i < length - REACH; i++) {
      const darker = Math.max(at(i - REACH), at(i + REACH)) - at(i);
      if (darker > 0) profile[i] += darker < CLIP ? darker : CLIP;
    }
  }
  return profile;
}

// How well a profile matches itself shifted by 1 … maxShift pixels
// (1 = perfectly, 0 = not at all, below 0 = opposite).
function selfMatch(profile, maxShift) {
  const n = profile.length;
  let mean = 0;
  for (const v of profile) mean += v;
  mean /= n;
  const centred = profile.map((v) => v - mean);
  let zero = 0;
  for (const v of centred) zero += v * v;
  const result = new Float64Array(maxShift + 1);
  if (zero === 0) return result;
  for (let shift = 1; shift <= maxShift && shift < n; shift++) {
    let sum = 0;
    for (let i = 0; i + shift < n; i++) sum += centred[i] * centred[i + shift];
    result[shift] = (sum / zero) * (n / (n - shift));
  }
  return result;
}

// Smooth a profile a little (about a sixth of a square), so lines that are a
// bit ragged or blurry still make one clear peak.
function blur(profile, pitch) {
  const half = Math.max(0, Math.floor(Math.round(pitch / 6) / 2));
  if (half === 0) return profile;
  const n = profile.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = i - half; j <= i + half; j++) if (j >= 0 && j < n) sum += profile[j];
    out[i] = sum;
  }
  return out;
}

// A profile's value between whole pixels.
function valueAt(profile, x) {
  const i = Math.floor(x);
  if (i < 0 || i >= profile.length - 1) return 0;
  return profile[i] + (profile[i + 1] - profile[i]) * (x - i);
}

// The comb with teeth `pitch` apart that lands best on the peaks:
// { phase (the first tooth), score (the average value under its teeth) }.
function bestComb(profile, pitch) {
  let best = { phase: 0, score: -1 };
  for (let phase = 0; phase < pitch; phase += 0.25) {
    let sum = 0;
    let teeth = 0;
    for (let x = phase; x < profile.length; x += pitch) {
      sum += valueAt(profile, x);
      teeth++;
    }
    if (sum / teeth > best.score) best = { phase, score: sum / teeth };
  }
  return best;
}

// Do lines `pitch` pixels apart really run through the strips? For each strip,
// place the best comb and count the teeth that are stronger than halfway
// between lines. Returns the share of such teeth (0–1), over all strips.
// A spacing that's too small puts half its teeth in the middle of squares.
function shareOnLines(strips, pitch) {
  let onLines = 0;
  let all = 0;
  for (const strip of strips) {
    const blurred = blur(strip, pitch);
    // The spacing is a first guess, so try a little either side of it.
    let best = bestComb(blurred, pitch - 0.5);
    let bestPitch = pitch - 0.5;
    for (let p = pitch - 0.45; p <= pitch + 0.5; p += 0.05) {
      const comb = bestComb(blurred, p);
      if (comb.score > best.score) {
        best = comb;
        bestPitch = p;
      }
    }
    for (let x = best.phase; x < blurred.length; x += bestPitch) {
      if (valueAt(blurred, x) > valueAt(blurred, x + bestPitch / 2)) onLines++;
      all++;
    }
  }
  return all === 0 ? 0 : onLines / all;
}
