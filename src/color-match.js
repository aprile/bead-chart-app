// Matching photo colours to bead colours, and choosing the best few colours.
// Colours are compared in Lab (see color-math.js), so "nearest" means
// "looks most alike", not "closest RGB numbers".

import { hexToRgb, rgbToLab } from './color-math.js';

function distance2(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function labOf(color) {
  return rgbToLab(hexToRgb(color.hex));
}

// Builds a fast "find the nearest colour" function for a list of colours.
// Each colour's Lab value is worked out once, and every photo colour we've
// already matched is remembered, so repeated colours cost nothing.
export function createColorMatcher(colors) {
  const labs = colors.map(labOf);
  const remembered = new Map(); // rgb as one number → colour

  return function nearest(rgb) {
    const key = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
    let found = remembered.get(key);
    if (found === undefined) {
      const lab = rgbToLab(rgb);
      let bestIndex = 0;
      let bestDistance = Infinity;
      for (let i = 0; i < labs.length; i++) {
        // Squared distance: same order as the real distance, without the square root.
        const distance = distance2(lab, labs[i]);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }
      found = colors[bestIndex];
      remembered.set(key, found);
    }
    return found;
  };
}

// ---------- Grouping colours (k-means) ----------

// A random number generator that gives the same numbers every time, so the
// same photo and settings always give the same colours (no flickering).
function seededRandom(seed) {
  return function random() {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Groups Lab points into k clusters ("k-means"): start with k well-spread
// points, then repeatedly put every point with its nearest centre and move
// each centre to the middle of its points.
// The result depends on where it starts, so we try a few starts and keep the
// one where points are closest to their centres overall.
// weights[i] = how many beads have points[i]. Returns [{ center, size }].
export function kMeans(points, weights, k, tries = 6) {
  let best = null;
  for (let seed = 1; seed <= tries; seed++) {
    const result = kMeansOnce(points, weights, k, seed);
    if (!best || result.error < best.error) best = result;
  }
  return best.clusters;
}

function kMeansOnce(points, weights, k, seed, iterations = 15) {
  const random = seededRandom(seed);

  // Start: the most common colour, then pick each next centre far from the
  // ones we have ("k-means++"), so small but distinct colours get a chance.
  let first = 0;
  weights.forEach((w, i) => {
    if (w > weights[first]) first = i;
  });
  const centers = [[...points[first]]];
  const nearestD2 = points.map((p) => distance2(p, centers[0]));
  while (centers.length < k) {
    const total = nearestD2.reduce((sum, d, i) => sum + d * weights[i], 0);
    if (total === 0) break; // every point is already a centre
    let target = random() * total;
    let pick = 0;
    while (pick < points.length - 1 && (target -= nearestD2[pick] * weights[pick]) > 0) pick++;
    centers.push([...points[pick]]);
    points.forEach((p, i) => {
      nearestD2[i] = Math.min(nearestD2[i], distance2(p, centers[centers.length - 1]));
    });
  }

  const assignment = new Int32Array(points.length).fill(-1);
  for (let round = 0; round < iterations; round++) {
    let moved = false;
    points.forEach((p, i) => {
      let best = 0;
      let bestD = Infinity;
      centers.forEach((c, j) => {
        const d = distance2(p, c);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      });
      if (assignment[i] !== best) {
        assignment[i] = best;
        moved = true;
      }
    });
    if (!moved) break;
    // Move each centre to the (weighted) middle of its points.
    const sums = centers.map(() => [0, 0, 0, 0]);
    points.forEach((p, i) => {
      const s = sums[assignment[i]];
      s[0] += p[0] * weights[i];
      s[1] += p[1] * weights[i];
      s[2] += p[2] * weights[i];
      s[3] += weights[i];
    });
    sums.forEach((s, j) => {
      if (s[3] > 0) centers[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }

  const sizes = centers.map(() => 0);
  let error = 0; // how far, in total, beads are from their cluster's centre
  points.forEach((p, i) => {
    sizes[assignment[i]] += weights[i];
    error += distance2(p, centers[assignment[i]]) * weights[i];
  });
  const clusters = centers.map((center, j) => ({ center, size: sizes[j] })).filter((c) => c.size > 0);
  return { clusters, error };
}

// ---------- Choosing the best N colours ----------

// rgbs = the bead colours from the photo (no empty beads).
// candidates = stash colours we may use. locked = colours that must be used.
// Returns up to `count` colours (more if more are locked).
export function chooseColors(rgbs, candidates, count, locked = []) {
  const wanted = Math.max(count, locked.length);

  // Group identical colours first, so each is only handled once.
  const groups = new Map();
  for (const rgb of rgbs) {
    const key = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
    const group = groups.get(key);
    if (group) group.weight++;
    else groups.set(key, { lab: rgbToLab(rgb), weight: 1 });
  }
  const points = [...groups.values()].map((g) => g.lab);
  const weights = [...groups.values()].map((g) => g.weight);

  // Group the photo's colours into `wanted` clusters, biggest first.
  const clusters = points.length > 0 ? kMeans(points, weights, Math.min(wanted, points.length)) : [];
  clusters.sort((a, b) => b.size - a.size);

  const chosen = [];
  const free = [...clusters];

  // Locked colours always stay; each one takes the cluster that looks most like it.
  for (const color of locked) {
    chosen.push(color);
    if (free.length === 0) continue;
    const lab = labOf(color);
    let nearest = 0;
    free.forEach((cluster, i) => {
      if (distance2(cluster.center, lab) < distance2(free[nearest].center, lab)) nearest = i;
    });
    free.splice(nearest, 1);
  }

  // Every other cluster (biggest first) gets the nearest stash colour not used yet.
  const candidateLabs = candidates.map(labOf);
  for (const cluster of free) {
    if (chosen.length >= wanted) break;
    const usedIds = new Set(chosen.map((color) => color.id));
    let best = -1;
    candidates.forEach((color, i) => {
      if (usedIds.has(color.id)) return;
      if (best === -1 || distance2(cluster.center, candidateLabs[i]) < distance2(cluster.center, candidateLabs[best])) {
        best = i;
      }
    });
    if (best !== -1) chosen.push(candidates[best]);
  }
  return chosen;
}
