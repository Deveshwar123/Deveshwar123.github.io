// Pure geometry for the original line art: the jali arch, the illustrated NFC board
// and small helpers. No DOM access, so the Node art script and the browser share it.
// Every shape is a polyline: an array of [x, y] points.
//
// Board space is 1120 × 640 units (the card's real 3.5 × 2 in proportions), y down,
// on an 8-unit construction grid. Jali space is CSS pixels relative to the box the
// arch is drawn around.

export const BOARD = Object.freeze({ W: 1120, H: 640, CX: 560, CY: 320, R: 40 });
const ANT = Object.freeze({ inset: 48, pitch: 20, turns: 5, chamfer: 16 });
export const ARCH_LINES = ANT.turns;

const round = (n) => Math.round(n * 10) / 10;

export function pathFromPoints(pts, closed = false) {
  let d = '';
  for (let i = 0; i < pts.length; i++) d += (i ? 'L' : 'M') + round(pts[i][0]) + ' ' + round(pts[i][1]);
  return closed ? d + 'Z' : d;
}

// Smooth path for static artwork. The line is split at corners (turns sharper
// than 25°: cusps, the pointed apex, rosette points) and each run between
// corners is thinned to points about `step` apart and drawn as Catmull-Rom
// curves (cubic Béziers). Same shape, a fraction of the bytes; the live morph
// keeps its dense polylines.
export function smoothPathFromPoints(pts, step = 22) {
  if (pts.length < 3) return pathFromPoints(pts);
  step = Math.min(step, polylineLength(pts) / 10);
  const runs = [];
  let run = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], [cx, cy] = pts[i + 1];
    const a1 = Math.atan2(by - ay, bx - ax), a2 = Math.atan2(cy - by, cx - bx);
    let turn = Math.abs(a2 - a1);
    if (turn > Math.PI) turn = 2 * Math.PI - turn;
    run.push(pts[i]);
    if (turn > (25 * Math.PI) / 180) { runs.push(run); run = [pts[i]]; }
  }
  run.push(pts[pts.length - 1]);
  runs.push(run);
  let d = 'M' + round(pts[0][0]) + ' ' + round(pts[0][1]);
  for (const r of runs) {
    const thin = [r[0]];
    for (let i = 1; i < r.length - 1; i++) {
      const [x, y] = thin[thin.length - 1];
      if (Math.hypot(r[i][0] - x, r[i][1] - y) >= step) thin.push(r[i]);
    }
    thin.push(r[r.length - 1]);
    if (thin.length === 2) { d += 'L' + round(thin[1][0]) + ' ' + round(thin[1][1]); continue; }
    for (let i = 0; i < thin.length - 1; i++) {
      const p0 = thin[i - 1] || thin[i], p1 = thin[i], p2 = thin[i + 1], p3 = thin[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += 'C' + [c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]].map(round).join(' ');
    }
  }
  return d;
}

export function circlePoints(cx, cy, r, n = 24, start = 0) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = start + (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

export function polylineLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return len;
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

// Rounded-rectangle outline that starts at bottom centre and runs clockwise on
// screen (left along the bottom first), matching the jali frame's direction.
function boardOutline() {
  const { W, H, CX, R } = BOARD;
  const pts = [[CX, H], [R, H]];
  const arc = (cx, cy, a0, a1) => {
    for (let i = 1; i <= 6; i++) {
      const a = a0 + ((a1 - a0) * i) / 6;
      pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
    }
  };
  arc(R, H - R, Math.PI / 2, Math.PI);
  pts.push([0, R]);
  arc(R, R, Math.PI, Math.PI * 1.5);
  pts.push([W - R, 0]);
  arc(W - R, R, Math.PI * 1.5, Math.PI * 2);
  pts.push([W, H - R]);
  arc(W - R, H - R, 0, Math.PI / 2);
  pts.push([CX, H]);
  return pts;
}

// One antenna turn: from bottom centre, left, up, across, down, back along the
// bottom, then a 45° jog inward to where the next turn starts. Together the five
// turns form one continuous rectangular spiral.
function antennaTurn(k) {
  const { W, H, CX } = BOARD;
  const i = ANT.inset + ANT.pitch * k;
  const x0 = i, y0 = i, x1 = W - i, y1 = H - i, c = ANT.chamfer;
  return [
    [CX, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c], [x0 + c, y0],
    [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1],
    [CX + ANT.pitch, y1], [CX, y1 - ANT.pitch],
  ];
}

const CHIP = Object.freeze({ x: 512, y: 352, w: 96, h: 96, pins: 6, pitch: 16, stub: 12 });

// A bus of traces from one side of the chip to a column of pads, with 45° bends.
// Successive traces keep a constant offset along the diagonal so none cross.
function bus(side) {
  const dir = side === 'left' ? -1 : 1;
  const pinX = side === 'left' ? CHIP.x - CHIP.stub : CHIP.x + CHIP.w + CHIP.stub;
  const padX = side === 'left' ? 212 : 908;
  const traces = [];
  for (let i = 0; i < CHIP.pins; i++) {
    const yPin = CHIP.y + 8 + i * CHIP.pitch;
    const yPad = 220 + i * 32;
    const bendX = pinX + dir * (30 + 8 * i);
    const dy = yPin - yPad;
    const diagEndX = bendX + dir * dy;
    traces.push({
      id: `${side[0]}${i}`,
      pts: [[pinX, yPin], [bendX, yPin], [diagEndX, yPad], [padX, yPad]],
      end: [padX + dir * 12, yPad],
    });
  }
  return traces;
}

function chipOutline() {
  const { x, y, w, h } = CHIP;
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
}

function pinStubs() {
  const stubs = [];
  for (let i = 0; i < CHIP.pins; i++) {
    const yy = CHIP.y + 8 + i * CHIP.pitch;
    stubs.push([[CHIP.x - CHIP.stub, yy], [CHIP.x, yy]]);
    stubs.push([[CHIP.x + CHIP.w, yy], [CHIP.x + CHIP.w + CHIP.stub, yy]]);
  }
  stubs.push([[544, 448], [544, 460]], [[576, 448], [576, 460]]);
  return stubs;
}

function rect(cx, cy, w, h) {
  return [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2], [cx - w / 2, cy - h / 2]];
}

// An eight-point jali star inside a circle, used as silkscreen art.
export function rosette(cx, cy, r) {
  const lines = [circlePoints(cx, cy, r, 48)];
  for (let s = 0; s < 2; s++) {
    const sq = [];
    for (let i = 0; i <= 4; i++) {
      const a = (s * Math.PI) / 4 + (i * Math.PI) / 2 - Math.PI / 4;
      sq.push([cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82]);
    }
    lines.push(sq);
  }
  lines.push(circlePoints(cx, cy, r * 0.34, 24));
  return lines;
}

// "DV" monogram drawn with grid-aligned strokes and 45° bends.
export function monogram(cx, cy, s) {
  const u = s / 8;
  return [
    // D
    [[cx - 7 * u, cy - 4 * u], [cx - 3 * u, cy - 4 * u], [cx - 1 * u, cy - 2 * u], [cx - 1 * u, cy + 2 * u], [cx - 3 * u, cy + 4 * u], [cx - 7 * u, cy + 4 * u], [cx - 7 * u, cy - 4 * u]],
    // V
    [[cx + 1 * u, cy - 4 * u], [cx + 4 * u, cy + 4 * u], [cx + 7 * u, cy - 4 * u]],
  ];
}

let boardCache = null;

// The complete illustrated board, grouped into the four visual construction
// layers. This is an illustration, not a manufacturing-accurate model.
export function boardGeometry() {
  if (boardCache) return boardCache;
  const left = bus('left');
  const right = bus('right');
  // Pair order: outermost pads first, alternating sides, so any prefix is balanced.
  const busTraces = [];
  for (let i = 0; i < CHIP.pins; i++) busTraces.push(left[i], right[i]);

  const antenna = [];
  for (let k = 0; k < ANT.turns; k++) antenna.push(antennaTurn(k));
  const outerStart = antenna[0][0];
  const innerEnd = antenna[ANT.turns - 1][antenna[ANT.turns - 1].length - 1];

  const feeds = [
    [outerStart, [outerStart[0] - 16, outerStart[1] + 16]],
    [[544, 476], [544, 460]],
    [innerEnd, [innerEnd[0] + 16, innerEnd[1] - 16], [576, 460]],
  ];
  const led = { x: 848, y: 172, w: 40, h: 24 };
  const vias = [
    [outerStart[0] - 16, outerStart[1] + 16], [544, 476],
    ...right.map((t) => t.end),
    [180, 180], [940, 180], [180, 460], [940, 460], [804, led.y],
  ];
  const pads = left.map((t) => t.end);

  boardCache = {
    outline: boardOutline(),
    antenna,
    busTraces,
    topCopper: {
      feeds,
      pinStubs: pinStubs(),
      ledPads: [rect(led.x - 14, led.y, 12, 16), rect(led.x + 14, led.y, 12, 16)],
      // LED anode branches off the outermost right trace; the cathode drops to a ground via.
      ledTraces: [[[886, 220], [862, 196], [862, led.y + 8]], [[led.x - 14, led.y], [812, led.y]]],
    },
    silkscreen: [
      chipOutline().map(([x, y]) => [x + (x > CHIP.x + 1 ? 8 : -8), y + (y > CHIP.y + 1 ? 8 : -8)]),
      circlePoints(CHIP.x + 10, CHIP.y + 10, 4, 12),
      rect(212, 300, 40, 216),
      rect(led.x, led.y, led.w + 16, led.h + 16),
      [[led.x - 4, led.y - 6], [led.x + 4, led.y], [led.x - 4, led.y + 6], [led.x - 4, led.y - 6]],
      ...rosette(560, 236, 64),
      ...monogram(560, 236, 34),
    ],
    bottomCopper: hatch(),
    bridge: [[outerStart[0] - 16, outerStart[1] + 16], [544, 476]],
    chip: CHIP,
    led,
    vias,
    pads,
  };
  return boardCache;
}

// Ground-plane hatch for the bottom copper: 45° lines clipped to the interior.
function hatch() {
  const lines = [];
  const x0 = 160, y0 = 160, x1 = 960, y1 = 480, step = 48;
  for (let c = x0 - (y1 - y0); c <= x1; c += step) {
    // Line x - y = c - y0 → points where it enters and leaves the rectangle.
    const pts = [];
    const ya = Math.max(y0, y0 + (x0 - c)), yb = Math.min(y1, y0 + (x1 - c));
    if (yb <= ya) continue;
    pts.push([c + (ya - y0), ya], [c + (yb - y0), yb]);
    lines.push(pts);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Jali arch
// ---------------------------------------------------------------------------

// Pointed arch profile: a blend of a quarter circle (vertical at the jamb) and a
// straight rise (so the two halves meet at an angle). s = 0 at the jamb, 1 at centre.
function archRise(s, lambda = 0.78) {
  const c = Math.sqrt(Math.max(0, 1 - (1 - s) * (1 - s)));
  return lambda * c + (1 - lambda) * s;
}

// Layout for an arch drawn around `box` (the crest text) inside `frame`.
// All values are CSS pixels in the caller's coordinate system.
export function archLayout(frame, box, opts = {}) {
  const gap = opts.gap ?? Math.max(5, Math.min(12, frame.w / 110));
  const padX = opts.padX ?? Math.max(14, Math.min(40, box.w * 0.05));
  const padY = opts.padY ?? 18;
  const cx = box.x + box.w / 2;
  const inner = Math.min(box.w / 2 + padX, frame.w / 2 - gap * (ARCH_LINES - 1) - 6);
  const s0 = Math.max(0.02, Math.min(0.9, (inner - box.w / 2) / inner));
  const room = box.y - frame.y - gap * (ARCH_LINES - 1) - 22;
  let rise = Math.min(inner * (opts.riseRatio ?? 0.62), Math.max(40, room / (1 - archRise(s0)) - padY));
  rise = Math.max(36, rise);
  const ys = Math.min(frame.y + frame.h - 8, box.y - padY + rise * archRise(s0));
  return { cx, inner, gap, rise, ys, frame };
}

// Sample one arch line k (0 = outermost) from its left foot over the apex to its
// right foot, evenly by arc length. The innermost line is cusped like a Mughal
// intrados: equal lobes whose points face into the opening.
function archLine(L, k, samples) {
  const { cx, inner, gap, rise, ys, frame } = L;
  const off = (ARCH_LINES - 1 - k) * gap;
  const w = inner + off;
  const R = rise + off * 1.15;
  const foot = frame.y + frame.h;
  const jamb = Math.max(0, foot - ys);

  // Fine base curve from the springing point to the apex.
  const fine = [];
  for (let i = 0; i <= 240; i++) {
    const s = i / 240;
    fine.push([cx - w + s * w, ys - R * archRise(s)]);
  }
  const curve = resampleEven(fine, k === ARCH_LINES - 1 ? samples * 2 : samples);
  if (k === ARCH_LINES - 1) {
    // Scalloped intrados: equal lobes by arc length, meeting in points.
    const half = polylineLength(curve);
    const lobes = Math.max(3, Math.min(6, Math.round(half / 90)));
    const depth = Math.min((half / lobes) * 0.2, 14);
    const base = curve.map((pt) => pt.slice());
    for (let i = 1; i < curve.length - 1; i++) {
      const t = i / (curve.length - 1);
      const f = (t * lobes) % 1;
      const d = depth * (1 - Math.sin(Math.PI * f));
      const [ax, ay] = base[i - 1], [bx, by] = base[i + 1];
      const tx = bx - ax, ty = by - ay, tl = Math.hypot(tx, ty) || 1;
      // Inward normal (toward the opening) is the tangent rotated clockwise.
      curve[i] = [base[i][0] - (ty / tl) * d, base[i][1] + (tx / tl) * d];
    }
    curve[curve.length - 1] = [curve[curve.length - 1][0], curve[curve.length - 1][1] + depth];
  }
  const jambSamples = Math.max(2, Math.round((jamb / (jamb + R * 1.4)) * samples));
  const pts = [];
  for (let i = 0; i < jambSamples; i++) pts.push([cx - w, foot - (jamb * i) / jambSamples]);
  pts.push(...curve);
  const right = pts.slice(0, -1).reverse().map(([x, y]) => [2 * cx - x, y]);
  return pts.concat(right);
}

// Resample a polyline to n + 1 points spaced evenly by arc length.
export function resampleEven(pts, n) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1] || 1;
  const out = [];
  let j = 1;
  for (let i = 0; i <= n; i++) {
    const target = (total * i) / n;
    while (j < cum.length - 1 && cum[j] < target) j++;
    const seg = cum[j] - cum[j - 1] || 1;
    const t = Math.min(1, Math.max(0, (target - cum[j - 1]) / seg));
    out.push([pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * t, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * t]);
  }
  return out;
}

// Two mirrored sine lines per ogee column; their crossings form the onion cells of
// a classic jali screen. Returns columns for one side panel.
function ogeePanel(x0, x1, top, bottom, side, maxPairs) {
  const width = x1 - x0;
  // Too narrow for a readable lattice: leave the panel plain.
  if (width < 44 || maxPairs < 1) return { lines: [], crossings: [], pairs: 0 };
  const pairs = Math.max(1, Math.min(maxPairs, Math.floor(width / 64)));
  const pw = width / pairs;
  const A = pw * 0.46;
  const lambda = Math.max(96, pw * 2.6);
  const lines = [];
  const crossings = [];
  for (let q = 0; q < pairs; q++) {
    const xc = x0 + (q + 0.5) * pw;
    for (const sign of [1, -1]) {
      const pts = [];
      const n = Math.max(24, Math.round((bottom - top) / 6));
      for (let i = 0; i <= n; i++) {
        const y = top + ((bottom - top) * i) / n;
        pts.push([xc + sign * A * Math.sin((2 * Math.PI * (y - top)) / lambda), y]);
      }
      lines.push({ pts, order: side === 'left' ? q : pairs - 1 - q, sign });
    }
    for (let y = top + lambda / 2; y < bottom - 4; y += lambda / 2) crossings.push([xc, y]);
  }
  // Outermost column first; within a column, the + line first.
  lines.sort((a, b) => a.order - b.order || b.sign - a.sign);
  return { lines: lines.map((l) => l.pts), crossings, pairs };
}

// Full jali composition. Returns morphable lines (frame, arches, waves) and
// ornament that fades as the lattice becomes circuitry.
export function jaliGeometry(frame, box, opts = {}) {
  const L = archLayout(frame, box, opts);
  const samples = opts.samples ?? 64;
  const { cx, inner, gap, ys } = L;
  const outerW = inner + (ARCH_LINES - 1) * gap;
  const { x, y, w, h } = frame;
  const B = y + h;

  const framePath = [[cx, B], [x, B], [x, y], [x + w, y], [x + w, B], [cx, B]];
  const arches = [];
  for (let k = 0; k < ARCH_LINES; k++) arches.push(archLine(L, k, samples));

  const m = Math.max(6, gap);
  const leftPanel = ogeePanel(x + m, cx - outerW - m, y + m, B - m, 'left', opts.maxPairs ?? 3);
  const rightPanel = ogeePanel(cx + outerW + m, x + w - m, y + m, B - m, 'right', opts.maxPairs ?? 3);
  // Interleave left/right so wave i pairs with board bus trace i (alternating sides).
  const waves = [];
  const n = Math.max(leftPanel.lines.length, rightPanel.lines.length);
  for (let i = 0; i < n; i++) {
    if (leftPanel.lines[i]) waves.push({ side: 'left', pts: leftPanel.lines[i] });
    if (rightPanel.lines[i]) waves.push({ side: 'right', pts: rightPanel.lines[i] });
  }

  const ornament = [];
  for (const [ox, oy] of [...leftPanel.crossings, ...rightPanel.crossings]) ornament.push(circlePoints(ox, oy, 3, 12));
  const apexY = ys - L.rise - (ARCH_LINES - 1) * gap * 1.15;
  if (apexY - y > 30) {
    ornament.push([[cx, apexY - 6], [cx, Math.max(y + 10, apexY - 28)]]);
    ornament.push(circlePoints(cx, Math.max(y + 10, apexY - 28) - 4, 4, 12));
  }
  // Spandrel rosettes between the arch and the frame's top corners.
  const spR = Math.min(26, (apexY - y) * 0.32, outerW * 0.12);
  if (spR > 8) {
    for (const sx of [-1, 1]) {
      const px = cx + sx * outerW * 0.62;
      const py = y + Math.max(spR + 8, (apexY - y) * 0.55 + spR * 0.4);
      for (const line of rosette(px, py, spR)) ornament.push(line);
    }
  }
  // Base moulding under the arch feet.
  ornament.push([[x + 4, B - 4], [x + w - 4, B - 4]]);

  return { layout: L, frame: framePath, arches, waves, ornament };
}

// ---------------------------------------------------------------------------
// Small static illustrations
// ---------------------------------------------------------------------------

// Orthographic wireframe globe (meridians and parallels) with a marker position.
export function globeGeometry(cx, cy, r, { lon0 = -80, lat0 = 22, step = 30 } = {}) {
  const toR = Math.PI / 180;
  const project = (lat, lon) => {
    const φ = lat * toR, λ = (lon - lon0) * toR, φ0 = lat0 * toR;
    const cosc = Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(λ);
    const px = r * Math.cos(φ) * Math.sin(λ);
    const py = r * (Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(λ));
    return { x: cx + px, y: cy - py, visible: cosc >= 0 };
  };
  const lines = [];
  const pushVisible = (samples) => {
    let cur = [];
    for (const s of samples) {
      if (s.visible) cur.push([s.x, s.y]);
      else if (cur.length) { if (cur.length > 1) lines.push(cur); cur = []; }
    }
    if (cur.length > 1) lines.push(cur);
  };
  for (let lon = -180; lon < 180; lon += step) {
    const s = [];
    for (let lat = -90; lat <= 90; lat += 3) s.push(project(lat, lon));
    pushVisible(s);
  }
  for (let lat = -60; lat <= 60; lat += step) {
    const s = [];
    for (let lon = -180; lon <= 180; lon += 3) s.push(project(lat, lon));
    pushVisible(s);
  }
  return { outline: circlePoints(cx, cy, r, 72), lines, project };
}
