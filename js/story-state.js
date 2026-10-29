// Pure story geometry and state. No DOM, no clocks: the same settled progress
// and viewport always produce the same output, in any order and at any frame
// rate. journey.js renders it; tests/unit/story.test.mjs pins it.

import { clamp, u, bell, easeScene } from './motion.js';
import { BOARD } from './art.js';

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
  // Narrow screens: the board forms low (below the departing hero text) and
  // rises into place as it turns.
  const w = Math.min(vw * 0.86, vh * 0.34 * (BOARD.W / BOARD.H));
  return { ppu: w / BOARD.W, cx: vw / 2, cy: vh * 0.66, cyPose: vh * 0.42, shiftX: 0 };
}

// Absolute story state for a settled progress value. Same p and viewport →
// same output, in any order and at any frame rate.
export function evaluateStory(p, vc) {
  const R = vc.ranges;
  const P = clamp(p, 0, vc.end);
  const morphT = easeScene(u(R.unravel[0], R.unravel[1], P));
  const cross = u(R.crossfade[0], R.crossfade[1], P);
  const rot = easeScene(u(R.crossfade[1], R.pose[1], P));
  const ex = easeScene(u(R.explode[0], R.explode[1], P));
  const hand = easeScene(u(R.handoff[0], R.handoff[1], P));
  const toRad = Math.PI / 180;
  const yaw = (rot * vc.yawDeg - ex * 8) * toRad;
  const pitch = -(rot * vc.pitchDeg + ex * 22) * toRad;
  const ppu = vc.framing.ppu;
  const pose = {
    yaw,
    pitch,
    tx: (vc.framing.cx - vc.vw / 2 + rot * vc.framing.shiftX) / ppu,
    ty: -(vc.framing.cy + (vc.framing.cyPose - vc.framing.cy) * rot - vc.vh / 2 - ex * vc.vh * 0.04) / ppu,
  };
  return {
    p: P,
    phase: P < R.unravel[1] ? 'morph' : 'board',
    morphT,
    lift: (vc.travel * P) / vc.end,
    ornament: 1 - u(R.ornamentFade[0], R.ornamentFade[1], P),
    vias: u(R.vias[0], R.vias[1], P),
    boardFill: u(R.vias[0], R.crossfade[1], P),
    svgOpacity: vc.webgl ? 1 - cross : 1,
    glOpacity: vc.webgl ? cross : 0,
    rot,
    pose,
    explode: ex * vc.explodeDistance,
    labels: u(R.explode[0] + 0.03, R.explode[0] + 0.08, P) * (1 - u(R.ledBell[0], R.handoff[0], P)),
    led: bell(R.ledBell[0], R.ledBell[1], R.ledBell[2], R.ledBell[3], P),
    stageOpacity: 1 - 0.82 * hand,
    stageScale: 1 - 0.08 * hand,
  };
}
