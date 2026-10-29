// Shared camera model. The WebGL board (board.js), the SVG fallback adapter and the
// static art all project board points through these functions, so the SVG traces
// and the 3D traces register exactly when the board is face-on.

import { BOARD } from './art.js';

export const FOV_DEG = 30;

// Board-local z of the four visual construction groups (silkscreen, top copper,
// substrate, bottom copper) for an explode distance in board units. These are
// visual groups of a two-copper-layer board, not four electrical layers.
// The slab is the card's real 1.6 mm (≈ 20 board units) thick.
const LAYER_Z = [10.35, 10.2, 0, -10.2];
const LAYER_SPREAD = [2.4, 1.2, 0, -1.2];
export const layerZ = (i, explode) => LAYER_Z[i] + LAYER_SPREAD[i] * explode;

// Camera for a viewport. `ppu` is CSS pixels per board unit when the board is
// face-on at z = 0, which fixes the camera distance.
export function makeCamera(vw, vh, ppu, fovDeg = FOV_DEG) {
  const f = vh / 2 / Math.tan((fovDeg * Math.PI) / 360);
  return { vw, vh, f, D: f / ppu, fovDeg, ppu };
}

// Rotation matrix for Three.js Euler order 'XYZ' (R = Rx(pitch) · Ry(yaw) · Rz(roll)), row-major.
export function rotation(yawRad, pitchRad, rollRad = 0) {
  const cy = Math.cos(yawRad), sy = Math.sin(yawRad);
  const cx = Math.cos(pitchRad), sx = Math.sin(pitchRad);
  const cz = Math.cos(rollRad), sz = Math.sin(rollRad);
  return [
    cy * cz, -cy * sz, sy,
    sx * sy * cz + cx * sz, -sx * sy * sz + cx * cz, -sx * cy,
    -cx * sy * cz + sx * sz, cx * sy * sz + sx * cz, cx * cy,
  ];
}

// Project a board point (board units, y down; z = layer offset toward the viewer)
// for a pose { yaw, pitch, roll?, tx, ty, tz? } where tx/ty/tz move the board
// centre in board units (tz toward the camera makes it larger).
export function projectPoint(bx, by, bz, pose, cam, R = rotation(pose.yaw, pose.pitch, pose.roll || 0), out = [0, 0, 0]) {
  const X = bx - BOARD.CX, Y = -(by - BOARD.CY), Z = bz;
  const wx = R[0] * X + R[1] * Y + R[2] * Z + pose.tx;
  const wy = R[3] * X + R[4] * Y + R[5] * Z + pose.ty;
  const wz = R[6] * X + R[7] * Y + R[8] * Z + (pose.tz || 0);
  const k = cam.f / (cam.D - wz);
  out[0] = cam.vw / 2 + wx * k;
  out[1] = cam.vh / 2 - wy * k;
  out[2] = wz;
  return out;
}

export function projectPolyline(pts, bz, pose, cam, R = rotation(pose.yaw, pose.pitch, pose.roll || 0)) {
  const out = new Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    const p = projectPoint(pts[i][0], pts[i][1], bz, pose, cam, R);
    out[i] = [p[0], p[1]];
  }
  return out;
}
