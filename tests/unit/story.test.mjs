// Story determinism, morph integrity and motion helpers (phases 3–5 gates).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateStory, trackGeometry, progressAt, scrollYFor, boardFraming } from '../../js/story-state.js';
import { jaliGeometry, boardGeometry, BOARD } from '../../js/art.js';
import { buildMorph, validatePair, interpolate, resampleVertices } from '../../js/morph.js';
import { cubicBezier, easeOut, smoothstep, bell, u, createSpring, easeScene } from '../../js/motion.js';
import { makeCamera, projectPoint, faceOnMatrix, rotation } from '../../js/projection.js';

const cfg = JSON.parse(readFileSync(new URL('../../data/site-config.json', import.meta.url)));
const J = cfg.journey;
const P = [0, 0.09, 0.18, 0.22, 0.28, 0.38, 0.48, 0.58, 0.59, 0.6, 0.61, 0.62];

function viewport(vw, vh, tier) {
  const geo = trackGeometry({ vw, vh, startY: 0, tier, journeyCfg: J });
  return { geo, vc: { vw, vh, travel: geo.travel, end: geo.end, ranges: J.ranges, yawDeg: J.pose.yawDeg, pitchDeg: J.pose.pitchDeg, framing: boardFraming(vw, vh, tier), webgl: tier === 'full', explodeDistance: 150 } };
}
const flat = (s) => [s.morphT, s.lift, s.ornament, s.vias, s.boardFill, s.svgOpacity, s.glOpacity, s.rot, s.pose.yaw, s.pose.pitch, s.pose.tx, s.pose.ty, s.explode, s.labels, s.led, s.stageOpacity, s.stageScale];
const close = (a, b, eps = 1e-6) => a.every((x, i) => Math.abs(x - b[i]) <= eps);

for (const [vw, vh, tier] of [[1440, 900, 'full'], [390, 844, 'compact'], [1024, 700, 'full']]) {
  const { geo, vc } = viewport(vw, vh, tier);

  test(`${vw}×${vh}: forward, reverse and random orders give identical states`, () => {
    const forward = P.map((p) => flat(evaluateStory(p, vc)));
    const reverse = [...P].reverse().map((p) => flat(evaluateStory(p, vc))).reverse();
    const order = [5, 0, 11, 3, 8, 1, 10, 6, 2, 9, 4, 7];
    const shuffled = [];
    for (const i of order) shuffled[i] = flat(evaluateStory(P[i], vc));
    P.forEach((p, i) => {
      assert.ok(close(forward[i], reverse[i]), `reverse differs at p=${p}`);
      assert.ok(close(forward[i], shuffled[i]), `random order differs at p=${p}`);
      assert.ok(forward[i].every(Number.isFinite), `non-finite at p=${p}`);
    });
  });

  test(`${vw}×${vh}: progress reaches .62 exactly at the end of the track`, () => {
    assert.equal(progressAt(geo.startY, geo), 0);
    assert.equal(progressAt(geo.startY + geo.travel, geo), 0.62);
    assert.equal(progressAt(geo.endY + 5000, geo), 0.62);
    for (const p of P) assert.ok(Math.abs(progressAt(scrollYFor(p, geo), geo) - p) < 1e-9);
    const t = tier === 'full' ? J.desktopTrack : J.mobileTrack;
    assert.equal(geo.trackH, Math.round(Math.max(t.minPx, t.viewports * vh)));
  });

  test(`${vw}×${vh}: no discontinuity at any range boundary`, () => {
    const bounds = new Set(Object.values(J.ranges).flat());
    for (const b of bounds) {
      const before = flat(evaluateStory(b - 1e-6, vc));
      const after = flat(evaluateStory(b + 1e-6, vc));
      before.forEach((x, i) => assert.ok(Math.abs(x - after[i]) < 1e-2 * Math.max(1, Math.abs(x)), `jump in channel ${i} at p=${b}`));
    }
  });

  test(`${vw}×${vh}: channel endpoints`, () => {
    const s0 = evaluateStory(0, vc), s18 = evaluateStory(0.18, vc), s62 = evaluateStory(0.62, vc);
    assert.equal(s0.morphT, 0);
    assert.equal(s18.morphT, 1);
    assert.equal(s0.ornament, 1);
    assert.equal(s18.ornament, 0);
    assert.equal(s0.lift, 0);
    assert.equal(evaluateStory(0.38, vc).rot, 1);
    assert.equal(evaluateStory(0.38, vc).explode, 0);
    assert.equal(evaluateStory(0.58, vc).explode, 150);
    assert.equal(s62.stageOpacity, 1 - 0.82);
    assert.equal(s62.led, 0);
    assert.deepEqual(flat(evaluateStory(0.7, vc)), flat(s62), 'story holds after handoff');
    if (tier === 'full') {
      assert.equal(evaluateStory(0.18, vc).glOpacity, 0);
      assert.equal(evaluateStory(0.22, vc).glOpacity, 1);
      assert.equal(evaluateStory(0.2, vc).glOpacity + evaluateStory(0.2, vc).svgOpacity, 1, 'complementary crossfade');
    }
  });

  test(`${vw}×${vh}: morph pairs are finite, spike-free and keep exact endpoints`, () => {
    const frame = { x: vw * 0.06, y: 80, w: vw * 0.88, h: vh * 0.6 };
    const box = { x: vw * 0.25, y: 80 + vh * 0.28, w: vw * 0.5, h: vh * 0.25 };
    const jali = jaliGeometry(frame, box, { maxPairs: vw >= 860 ? 3 : 1 });
    const morph = buildMorph(jali, boardGeometry());
    assert.ok(morph.pairs.length >= 6);
    for (const pair of morph.pairs) assert.deepEqual(validatePair(pair), [], pair.id);
    // Rendering at t = 1 lands exactly on the face-on board transform of the trace.
    const m = [0.5, 0, 0, 0.5, 100, 50];
    const arch = morph.pairs.find((p) => p.id === 'arch-0');
    const out = interpolate(arch, 1, 123, m, new Float32Array(arch.n * 2));
    assert.ok(Math.abs(out[0] - (arch.toPts[0][0] * 0.5 + 100)) < 1e-3);
  });
}

test('the narrative LED is a single progress-defined pulse that reverses', () => {
  const { vc } = viewport(1440, 900, 'full');
  const ps = [];
  for (let p = 0.575; p <= 0.615; p += 0.0025) ps.push(+p.toFixed(4));
  const led = ps.map((p) => evaluateStory(p, vc).led);
  const peak = Math.max(...led);
  assert.equal(peak, 1);
  assert.equal(evaluateStory(0.595, vc).led, 1);
  assert.equal(evaluateStory(0.575, vc).led, 0);
  assert.equal(evaluateStory(0.615, vc).led, 0);
  let rises = 0;
  for (let i = 1; i < led.length; i++) if (led[i] > led[i - 1] && (i < 2 || led[i - 1] <= led[i - 2])) rises++;
  assert.equal(rises, 1, 'one pulse');
});

test('trace corners survive resampling', () => {
  const pts = [[0, 0], [100, 0], [150, 50], [300, 50]];
  const out = resampleVertices(pts, 32);
  assert.equal(out.length, 32);
  for (const v of pts) assert.ok(out.some((q) => q[0] === v[0] && q[1] === v[1]), `lost corner ${v}`);
});

test('the real board traces route on 45°/90° bends without crossings', () => {
  const B = boardGeometry();
  const segs = [];
  for (const t of B.busTraces) for (let i = 1; i < t.pts.length; i++) {
    const [a, b] = [t.pts[i - 1], t.pts[i]];
    const dx = Math.abs(b[0] - a[0]), dy = Math.abs(b[1] - a[1]);
    assert.ok(dx === 0 || dy === 0 || Math.abs(dx - dy) < 1e-9, `non-45° segment in ${t.id}`);
    segs.push([a, b, t.id]);
  }
  const cross = (p, q, r, s) => {
    const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
    if (!d) return false;
    const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d;
    const v = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
    return t > 1e-6 && t < 1 - 1e-6 && v > 1e-6 && v < 1 - 1e-6;
  };
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    if (segs[i][2] === segs[j][2]) continue;
    assert.ok(!cross(segs[i][0], segs[i][1], segs[j][0], segs[j][1]), `${segs[i][2]} crosses ${segs[j][2]}`);
  }
  // The real five-turn coil: consecutive turns share an endpoint (one continuous spiral).
  assert.equal(B.antenna.length, 5);
  const same = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6;
  for (let k = 0; k + 1 < B.antenna.length; k++) {
    const a = B.antenna[k], b = B.antenna[k + 1];
    assert.ok(same(a.at(-1), b[0]) || same(a[0], b.at(-1)), `turns ${k} and ${k + 1} are not joined`);
  }
});

test('face-on projection matches the SVG board transform (registration)', () => {
  const cam = makeCamera(1440, 900, 0.6);
  const pose = { yaw: 0, pitch: 0, tx: 37, ty: -12 };
  const m = faceOnMatrix(pose, cam);
  for (const [x, y] of [[0, 0], [BOARD.W, BOARD.H], [300, 500]]) {
    const q = projectPoint(x, y, 0, pose, cam, rotation(0, 0));
    assert.ok(Math.abs(q[0] - (m[0] * x + m[4])) < 1e-9 && Math.abs(q[1] - (m[3] * y + m[5])) < 1e-9);
  }
});

test('easing helpers are numerically defined', () => {
  assert.equal(easeOut(0.5), 0.875);
  assert.equal(smoothstep(0.5), 0.5);
  assert.equal(easeOut(-1), 0);
  assert.equal(smoothstep(2), 1);
  assert.ok(Math.abs(easeScene(0.5) - 0.5) < 1e-6);
  const ui = cubicBezier(0.2, 0.7, 0.2, 1);
  assert.ok(ui(0.25) > 0.6 && ui(0.25) < 0.8);
  assert.equal(ui(0), 0);
  assert.equal(ui(1), 1);
  assert.equal(u(0.1, 0.2, 0.15).toFixed(6), '0.500000');
  assert.equal(bell(0.58, 0.59, 0.6, 0.61, 0.595), 1);
});

test('the spring settles in finite steps and never explodes', () => {
  const s = createSpring({ mass: 1, stiffness: 170, damping: 18 }, 0);
  s.target = 6;
  let steps = 0;
  while (!s.step(500) && steps < 200) steps++; // huge frame gaps are clamped
  assert.ok(steps < 200, 'did not settle');
  assert.equal(s.value, 6);
});

test('story state uses no clocks or crossing timers', () => {
  const src = readFileSync(new URL('../../js/story-state.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /Date\.|performance\.|setTimeout|setInterval|requestAnimationFrame/);
});
