// Story determinism, the hero pose, captions and motion helpers (phases 3–5 gates).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateStory, trackGeometry, progressAt, scrollYFor, boardFraming, heroPose } from '../../js/story-state.js';
import { boardGeometry, BOARD } from '../../js/art.js';
import { cubicBezier, easeOut, smoothstep, bell, u, createSpring, easeScene } from '../../js/motion.js';
import { makeCamera, projectPoint, rotation } from '../../js/projection.js';

const cfg = JSON.parse(readFileSync(new URL('../../data/site-config.json', import.meta.url)));
const J = cfg.journey;
const P = [0, 0.03, 0.09, 0.18, 0.22, 0.28, 0.32, 0.38, 0.48, 0.58, 0.59, 0.6, 0.61, 0.62];
const RAD = Math.PI / 180;

function viewport(vw, vh, tier, webgl = true) {
  const geo = trackGeometry({ vw, vh, startY: 0, tier, journeyCfg: J });
  // Where the hero column puts the card (as journey.js measures it from the DOM).
  const hero = tier === 'full' ? { cx: vw * 0.72, cy: vh * 0.5, w: vw * 0.46 * J.hero.widthRatio } : { cx: vw / 2, cy: vh * 0.52, w: vw * 0.76 * J.hero.widthRatio };
  return {
    geo,
    vc: {
      vw, vh, travel: geo.travel, end: geo.end, ranges: J.ranges, yawDeg: J.pose.yawDeg, pitchDeg: J.pose.pitchDeg,
      framing: boardFraming(vw, vh, tier), webgl, explodeDistance: 150, captionWindows: J.captionWindows, hero, heroCfg: J.hero,
    },
  };
}
const flat = (s) => [s.arrive, s.heroLive, s.heroShadow, s.svgOpacity, s.glOpacity, s.pose.yaw, s.pose.pitch, s.pose.roll, s.pose.tx, s.pose.ty, s.pose.tz, s.explode, s.labels, s.led, s.stageOpacity, s.stageScale, ...s.captions];
const close = (a, b, eps = 1e-6) => a.every((x, i) => Math.abs(x - b[i]) <= eps);

for (const [vw, vh, tier] of [[1440, 900, 'full'], [390, 844, 'compact'], [1024, 700, 'full']]) {
  const { geo, vc } = viewport(vw, vh, tier);

  test(`${vw}×${vh}: forward, reverse and random orders give identical states`, () => {
    const forward = P.map((p) => flat(evaluateStory(p, vc)));
    const reverse = [...P].reverse().map((p) => flat(evaluateStory(p, vc))).reverse();
    const order = [5, 0, 13, 3, 8, 1, 12, 10, 6, 2, 11, 9, 4, 7];
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

  test(`${vw}×${vh}: no discontinuity at any range or caption boundary`, () => {
    const bounds = new Set([...Object.values(J.ranges).flat(), ...J.captionWindows.flat()]);
    for (const b of bounds) {
      const before = flat(evaluateStory(b - 1e-6, vc));
      const after = flat(evaluateStory(b + 1e-6, vc));
      before.forEach((x, i) => assert.ok(Math.abs(x - after[i]) < 1e-2 * Math.max(1, Math.abs(x)), `jump in channel ${i} at p=${b}`));
    }
  });

  test(`${vw}×${vh}: the card starts in the hero column at the hero size`, () => {
    // Unrotated, the hero pose's translation and depth put the card's centre at
    // the measured spot, exactly the measured width across.
    const cam = makeCamera(vw, vh, vc.framing.ppu);
    const H = heroPose(vc);
    const pose = { yaw: 0, pitch: 0, roll: 0, ...H };
    const c = projectPoint(BOARD.CX, BOARD.CY, 0, pose, cam);
    const l = projectPoint(0, BOARD.CY, 0, pose, cam), r = projectPoint(BOARD.W, BOARD.CY, 0, pose, cam);
    assert.ok(Math.abs(c[0] - vc.hero.cx) < 1e-6 && Math.abs(c[1] - vc.hero.cy) < 1e-6, 'centre');
    assert.ok(Math.abs(r[0] - l[0] - vc.hero.w) < 1e-6, 'width');
    const s0 = evaluateStory(0, vc);
    assert.deepEqual([s0.pose.tx, s0.pose.ty, s0.pose.tz], [H.tx, H.ty, H.tz]);
    assert.ok(Math.abs(s0.pose.yaw - J.hero.yawDeg * RAD) < 1e-12 && Math.abs(s0.pose.roll - J.hero.rollDeg * RAD) < 1e-12);
  });

  test(`${vw}×${vh}: channel endpoints`, () => {
    const s0 = evaluateStory(0, vc), s18 = evaluateStory(0.18, vc), s62 = evaluateStory(0.62, vc);
    assert.equal(s0.arrive, 0);
    assert.equal(s18.arrive, 1);
    assert.equal(s0.heroLive, 1);
    assert.equal(evaluateStory(0.06, vc).heroLive, 0);
    assert.equal(s0.heroShadow, 1);
    assert.equal(s18.heroShadow, 0);
    assert.equal(s18.pose.tz, 0);
    assert.equal(s18.pose.roll, 0);
    // Flipped to the back between the flip and unflip ranges, face-on again after.
    assert.ok(Math.abs(evaluateStory(0.32, vc).pose.yaw - Math.PI) < 1e-12);
    assert.ok(Math.abs(evaluateStory(0.4, vc).pose.yaw - J.pose.yawDeg * RAD) < 1e-12);
    // The layers split apart, hold while each is named, then come back together.
    const R = J.ranges;
    assert.equal(evaluateStory(R.explode[0], vc).explode, 0);
    assert.equal(evaluateStory(R.explode[1], vc).explode, 150);
    assert.equal(evaluateStory(R.join[0], vc).explode, 150);
    assert.equal(evaluateStory(R.join[1], vc).explode, 0);
    assert.equal(s62.explode, 0, 'the card ends whole');
    for (let p = R.explode[1]; p <= R.join[0]; p += 0.0025) assert.equal(evaluateStory(p, vc).labels, 1, `every layer is named at p=${p.toFixed(4)}`);
    assert.equal(evaluateStory(R.join[1], vc).labels, 0, 'no layer names once the card is whole');
    assert.equal(s62.stageOpacity, 1 - 0.82);
    assert.equal(s62.led, 0);
    assert.deepEqual(flat(evaluateStory(0.7, vc)), flat(s62), 'story holds after handoff');
    for (const p of P) {
      const s = evaluateStory(p, vc);
      assert.equal(s.glOpacity, 1);
      assert.equal(s.svgOpacity, 0);
    }
  });

  test(`${vw}×${vh}: one caption at a time, each fully shown inside its window`, () => {
    for (let p = 0; p <= 0.62; p += 0.0025) {
      const shown = evaluateStory(p, vc).captions.filter((o) => o > 0);
      assert.ok(shown.length <= 1, `two captions at p=${p.toFixed(4)}`);
    }
    J.captionWindows.forEach(([s, e], i) => assert.equal(evaluateStory((s + e) / 2, vc).captions[i], 1));
  });
}

test('without WebGL the hero keeps its still and the line-art card fades in as it arrives', () => {
  const { vc } = viewport(390, 844, 'compact', false);
  assert.equal(evaluateStory(0, vc).svgOpacity, 0);
  assert.equal(evaluateStory(0.18, vc).svgOpacity, 1);
  assert.equal(evaluateStory(0.3, vc).glOpacity, 0);
});

test('the narrative LED is a single progress-defined pulse that reverses', () => {
  const { vc } = viewport(1440, 900, 'full');
  const ps = [];
  const [l0, l1, l2, l3] = J.ranges.ledBell;
  for (let p = l0 - 0.01; p <= l3 + 0.01; p += 0.0025) ps.push(+p.toFixed(4));
  const led = ps.map((p) => evaluateStory(p, vc).led);
  const peak = Math.max(...led);
  assert.equal(peak, 1);
  assert.equal(evaluateStory((l1 + l2) / 2, vc).led, 1);
  assert.equal(evaluateStory(l0 - 0.005, vc).led, 0);
  assert.equal(evaluateStory(l3 + 0.005, vc).led, 0);
  // It lights once the layers are back together and stays lit for the last caption.
  assert.ok(l0 >= J.ranges.join[1] - 0.005);
  const [w0, w1] = J.captionWindows[3];
  for (let p = w0; p <= w1; p += 0.0025) assert.equal(evaluateStory(p, vc).led, 1, `LED at p=${p.toFixed(4)}`);
  let rises = 0;
  for (let i = 1; i < led.length; i++) if (led[i] > led[i - 1] && (i < 2 || led[i - 1] <= led[i - 2])) rises++;
  assert.equal(rises, 1, 'one pulse');
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

test('roll follows Three.js Euler XYZ (pitch · yaw · roll)', () => {
  const r = 0.3;
  const R = rotation(0, 0, r);
  assert.ok(Math.abs(R[0] - Math.cos(r)) < 1e-12 && Math.abs(R[3] - Math.sin(r)) < 1e-12 && Math.abs(R[6]) < 1e-12);
  // Composite: X axis under pitch p and yaw y with roll 0 matches the old two-angle matrix.
  const [y, p] = [0.4, -0.2];
  const A = rotation(y, p), B = rotation(y, p, 0);
  assert.deepEqual(A, B);
  assert.ok(Math.abs(A[2] - Math.sin(y)) < 1e-12 && Math.abs(A[5] + Math.sin(p) * Math.cos(y)) < 1e-12);
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
