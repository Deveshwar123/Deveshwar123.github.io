// Point correspondence for the jali → trace morph. Each pair is resampled once
// (outside the frame loop) into matched typed arrays; interpolation then writes
// into a reusable buffer. Endpoints are rendered from the original artwork, so
// t = 0 and t = 1 reproduce the source paths exactly.

import { resampleEven } from './art.js';

// Resample a polyline to n points while keeping every original vertex, so
// 45°/90° trace corners stay sharp through the end of the morph.
export function resampleVertices(pts, n) {
  if (pts.length >= n) return resampleEven(pts, n - 1);
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(len);
    total += len;
  }
  const spare = n - pts.length;
  const extra = segs.map((len) => (total ? (len / total) * spare : 0));
  const counts = extra.map(Math.floor);
  let left = spare - counts.reduce((a, b) => a + b, 0);
  // Hand out the remainder to the segments with the largest fractional parts.
  const order = extra.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k++, left--) counts[order[k % order.length][1]]++;
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    for (let j = 1; j <= counts[i - 1]; j++) {
      const t = j / (counts[i - 1] + 1);
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
    }
    out.push(pts[i]);
  }
  return out;
}

// A matched pair: `from` in jali space (CSS px), `to` in board space (units).
export function makePair(id, fromPts, toPts, n) {
  const a = resampleEven(fromPts, n - 1);
  const b = resampleVertices(toPts, n);
  const from = new Float32Array(n * 2);
  const to = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    from[2 * i] = a[i][0]; from[2 * i + 1] = a[i][1];
    to[2 * i] = b[i][0]; to[2 * i + 1] = b[i][1];
  }
  return { id, n, from, to, fromPts, toPts, out: new Float32Array(n * 2) };
}

// Interpolate a pair at t ∈ [0, 1] into screen space. `lift` moves the jali
// endpoint (it scrolls with the hero); `m` = [s, 0, 0, s, tx, ty] maps board
// units to screen pixels for the face-on board.
export function interpolate(pair, t, lift, m, out = pair.out) {
  const { from, to, n } = pair;
  const s = m[0], tx = m[4], ty = m[5];
  const k = 1 - t;
  for (let i = 0; i < n; i++) {
    const j = 2 * i;
    out[j] = from[j] * k + (to[j] * s + tx) * t;
    out[j + 1] = (from[j + 1] - lift) * k + (to[j + 1] * s + ty) * t;
  }
  return out;
}

export function arrayToPath(arr, n) {
  let d = 'M' + arr[0].toFixed(1) + ' ' + arr[1].toFixed(1);
  for (let i = 1; i < n; i++) d += 'L' + arr[2 * i].toFixed(1) + ' ' + arr[2 * i + 1].toFixed(1);
  return d;
}

// Checks used by the unit tests and once at start-up in development:
// finite coordinates, exact endpoints, and no segment longer than the longest
// corresponding source segment (interpolated segments are convex combinations,
// so a longer one would be a spike).
export function validatePair(pair, ts = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
  const errors = [];
  const id = [1, 0, 0, 1, 0, 0];
  const maxSeg = (arr) => {
    let m = 0;
    for (let i = 1; i < pair.n; i++) m = Math.max(m, Math.hypot(arr[2 * i] - arr[2 * i - 2], arr[2 * i + 1] - arr[2 * i - 1]));
    return m;
  };
  const limit = Math.max(maxSeg(pair.from), maxSeg(pair.to)) + 1e-3;
  for (const t of ts) {
    const out = interpolate(pair, t, 0, id, new Float32Array(pair.n * 2));
    for (let i = 0; i < out.length; i++) if (!Number.isFinite(out[i])) { errors.push(`${pair.id}: non-finite at t=${t}`); break; }
    if (maxSeg(out) > limit) errors.push(`${pair.id}: spike at t=${t}`);
  }
  const f = pair.fromPts, g = pair.toPts;
  const near = (x, y, p) => Math.abs(x - p[0]) < 1e-3 && Math.abs(y - p[1]) < 1e-3;
  if (!near(pair.from[0], pair.from[1], f[0]) || !near(pair.from[2 * pair.n - 2], pair.from[2 * pair.n - 1], f[f.length - 1])) errors.push(`${pair.id}: jali endpoints moved`);
  if (!near(pair.to[0], pair.to[1], g[0]) || !near(pair.to[2 * pair.n - 2], pair.to[2 * pair.n - 1], g[g.length - 1])) errors.push(`${pair.id}: trace endpoints moved`);
  return errors;
}

// Build every pair for a jali composition and the board. Waves pair with bus
// traces (reversed so each starts at its pad, near the wave's top); traces with
// no partner are returned for a fade-in.
export function buildMorph(jali, board, { arcPoints = 96, wavePoints = 64 } = {}) {
  const pairs = [makePair('frame', jali.frame, board.outline, arcPoints)];
  jali.arches.forEach((a, k) => pairs.push(makePair(`arch-${k}`, a, board.antenna[k], arcPoints)));
  const used = new Set();
  jali.waves.forEach((w, i) => {
    const want = w.side === 'left' ? 'l' : 'r';
    const trace = board.busTraces.find((t, j) => !used.has(j) && t.id[0] === want && (used.add(j), true));
    if (trace) pairs.push(makePair(`wave-${i}`, w.pts, trace.pts.slice().reverse(), wavePoints));
  });
  const unpaired = board.busTraces.filter((_, j) => !used.has(j)).map((t) => t.pts);
  return { pairs, unpaired };
}
