// Pure story geometry and state. No DOM, no clocks: the same settled progress
// and viewport always produce the same output, in any order and at any frame
// rate. journey.js renders it; tests/unit/story.test.mjs pins it.
//
// Beats: the card waits beside the hero text, glides to face-on at the centre,
// flips to show the back, flips back while tilting into the hero pose, splits
// into its layers (one skill each), comes back together and lights its LED,
// then settles into the background.

import { clamp, u, bell, easeScene } from './motion.js';
import { BOARD } from './art.js';
import { makeCamera } from './projection.js';

export function trackGeometry({ vw, vh, startY, tier, journeyCfg }) {
  const t = tier === 'full' ? journeyCfg.desktopTrack : journeyCfg.mobileTrack;
  const trackH = Math.round(Math.max(t.minPx, t.viewports * vh));
  const travel = Math.max(1, trackH - vh);
  return { vw, vh, startY, trackH, travel, endY: startY + trackH, end: journeyCfg.end };
}

export const progressAt = (y, g) => g.end * clamp((y - g.startY) / g.travel, 0, 1);
export const scrollYFor = (p, g) => g.startY + (g.travel * p) / g.end;

// Face-on board placement for a viewport: pixels per board unit and centre.
export function boardFraming(vw, vh, tier) {
  if (tier === 'full') {
    const w = Math.min(vw * 0.46, vh * 0.5 * (BOARD.W / BOARD.H), 760);
    return { ppu: w / BOARD.W, cx: vw * 0.58, cy: vh * 0.52, cyPose: vh * 0.52, shiftX: vw * 0.04 };
  }
  const w = Math.min(vw * 0.86, vh * 0.34 * (BOARD.W / BOARD.H));
  return { ppu: w / BOARD.W, cx: vw / 2, cy: vh * 0.44, cyPose: vh * 0.42, shiftX: 0 };
}

// The pose that puts the card's centre at (cx, cy) on screen, `w` pixels wide,
// using depth (tz) for size so the camera never changes.
export function heroPose(vc) {
  const { cx, cy, w } = vc.hero;
  const cam = makeCamera(vc.vw, vc.vh, vc.framing.ppu);
  const k = Math.max(0.2, w / (BOARD.W * vc.framing.ppu));
  const tz = cam.D * (1 - 1 / k);
  const depth = (cam.D - tz) / cam.f;
  return { tx: (cx - vc.vw / 2) * depth, ty: -(cy - vc.vh / 2) * depth, tz };
}

const lerp = (a, b, t) => a + (b - a) * t;
const RAD = Math.PI / 180;

export function evaluateStory(p, vc) {
  const R = vc.ranges;
  const P = clamp(p, 0, vc.end);
  const a = easeScene(u(R.arrive[0], R.arrive[1], P));
  const flip = easeScene(u(R.flip[0], R.flip[1], P));
  const unflip = easeScene(u(R.unflip[0], R.unflip[1], P));
  const rot = easeScene(u(R.pose[0], R.pose[1], P));
  const join = easeScene(u(R.join[0], R.join[1], P));
  const ex = easeScene(u(R.explode[0], R.explode[1], P)) * (1 - join);
  const hand = easeScene(u(R.handoff[0], R.handoff[1], P));
  const ppu = vc.framing.ppu;
  const H = heroPose(vc);
  const face = {
    tx: (vc.framing.cx - vc.vw / 2 + rot * vc.framing.shiftX) / ppu,
    ty: -(vc.framing.cy + (vc.framing.cyPose - vc.framing.cy) * rot - vc.vh / 2 - ex * vc.vh * 0.04) / ppu,
  };
  const h = vc.heroCfg;
  const pose = {
    yaw: (lerp(h.yawDeg, 0, a) + 180 * (flip - unflip) + rot * vc.yawDeg - ex * 8) * RAD,
    pitch: (lerp(h.pitchDeg, 0, a) - (rot * vc.pitchDeg + ex * 30)) * RAD,
    roll: lerp(h.rollDeg, 0, a) * RAD,
    tx: lerp(H.tx, face.tx, a),
    ty: lerp(H.ty, face.ty, a),
    tz: lerp(H.tz, 0, a),
  };
  return {
    p: P,
    arrive: a,
    // How much of the optional hero layer (pointer tilt, idle float, shadow) applies.
    heroLive: 1 - u(0, 0.06, P),
    heroShadow: 1 - a,
    // Without WebGL the hero keeps its still; the line-art card takes over as it arrives.
    svgOpacity: vc.webgl ? 0 : a,
    glOpacity: vc.webgl ? 1 : 0,
    pose,
    explode: ex * vc.explodeDistance,
    labels: u(R.explode[0] + 0.03, R.explode[1], P) * (1 - u(R.join[0], R.join[1], P)),
    led: bell(R.ledBell[0], R.ledBell[1], R.ledBell[2], R.ledBell[3], P),
    stageOpacity: 1 - 0.82 * hand,
    stageScale: 1 - 0.08 * hand,
    // One caption at a time, each fading in and out inside its own window.
    captions: (vc.captionWindows || []).map(([s, e]) => bell(s - 0.02, s, e, e + 0.02, P)),
  };
}
