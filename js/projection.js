// Shared camera model. The WebGL board (board.js), the SVG fallback adapter and the
// static art all project board points through these functions, so the SVG traces
// and the 3D traces register exactly when the board is face-on.

import { BOARD } from './art.js';

export const FOV_DEG = 30;

// Camera for a viewport. `ppu` is CSS pixels per board unit when the board is
// face-on at z = 0, which fixes the camera distance.
export function makeCamera(vw, vh, ppu, fovDeg = FOV_DEG) {
  const f = vh / 2 / Math.tan((fovDeg * Math.PI) / 360);
  return { vw, vh, f, D: f / ppu, fovDeg, ppu };
}

// Rotation matrix for Three.js Euler order 'XYZ' (R = Rx(pitch) · Ry(yaw)), row-major.
export function rotation(yawRad, pitchRad) {
  const cy = Math.cos(yawRad), sy = Math.sin(yawRad);
  const cx = Math.cos(pitchRad), sx = Math.sin(pitchRad);
  return [
    cy, 0, sy,
    sx * sy, cx, -sx * cy,
    -cx * sy, sx, cx * cy,
  ];
}

// Project a board point (board units, y down; z = layer offset toward the viewer)
// for a pose { yaw, pitch, tx, ty } where tx/ty move the board centre in board units.
export function projectPoint(bx, by, bz, pose, cam, R = rotation(pose.yaw, pose.pitch), out = [0, 0, 0]) {
  const X = bx - BOARD.CX, Y = -(by - BOARD.CY), Z = bz;
  const wx = R[0] * X + R[1] * Y + R[2] * Z + pose.tx;
  const wy = R[3] * X + R[4] * Y + R[5] * Z + pose.ty;
  const wz = R[6] * X + R[7] * Y + R[8] * Z;
  const k = cam.f / (cam.D - wz);
  out[0] = cam.vw / 2 + wx * k;
  out[1] = cam.vh / 2 - wy * k;
  out[2] = wz;
  return out;
}

export function projectPolyline(pts, bz, pose, cam, R = rotation(pose.yaw, pose.pitch)) {
  const out = new Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    const p = projectPoint(pts[i][0], pts[i][1], bz, pose, cam, R);
    out[i] = [p[0], p[1]];
  }
  return out;
}

// Board-space → screen transform for the face-on pose (an SVG matrix).
export function faceOnMatrix(pose, cam) {
  const s = cam.ppu;
  const cx = cam.vw / 2 + pose.tx * s;
  const cy = cam.vh / 2 - pose.ty * s;
  return [s, 0, 0, s, cx - BOARD.CX * s, cy - BOARD.CY * s];
}
