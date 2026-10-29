// SVG rendering of the illustrated board through the shared camera model. Used
// by the story on narrow screens and as the NFC panel's fallback when WebGL is
// unavailable or busy. Same geometry and layer offsets as the WebGL board.

import { boardGeometry } from './art.js';
import { rotation, projectPoint, layerZ } from './projection.js';

const SVGNS = 'http://www.w3.org/2000/svg';
let cache = null;

// Lines for the four visual construction groups of the real card: silkscreen
// (outline + part outlines), top copper (antenna, traces, pads, vias),
// substrate edge, bottom copper (the antenna bridge).
export function boardLayerLines() {
  if (cache) return cache;
  const B = boardGeometry();
  cache = [
    [B.outline, ...B.partOutlines],
    [...B.antenna, ...B.busTraces.map((t) => t.pts), ...B.padPolys, ...B.viaRings],
    [B.outline],
    [B.outline, ...B.bridge, ...B.viaRings],
  ];
  return cache;
}

// Rounded rings around the real antenna coil on the board plane: the
// illustrative field shown on the NFC panel. Bounded to three rings.
export function fieldRings() {
  const B = boardGeometry();
  const xs = B.antenna.flat().map((p) => p[0]), ys = B.antenna.flat().map((p) => p[1]);
  const [x0c, x1c, y0c, y1c] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const rings = [];
  for (const grow of [40, 90, 150]) {
    const r = 30 + grow * 0.5;
    const x0 = x0c - grow, y0 = y0c - grow, x1 = x1c + grow, y1 = y1c + grow;
    const pts = [];
    const corner = (cx, cy, a0) => { for (let i = 0; i <= 6; i++) { const a = a0 + (i / 6) * (Math.PI / 2); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
    corner(x1 - r, y1 - r, 0);
    corner(x0 + r, y1 - r, Math.PI / 2);
    corner(x0 + r, y0 + r, Math.PI);
    corner(x1 - r, y0 + r, Math.PI * 1.5);
    pts.push(pts[0]);
    rings.push(pts);
  }
  return rings;
}

function el(name, attrs, parent) {
  const n = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent.appendChild(n);
  return n;
}

export function createSvgBoard(parent) {
  const group = el('g', { class: 'art stage-board' }, parent);
  const fill = el('path', { class: 'art-board-fill' }, group);
  const paths = ['art-silk', 'art-traces', 'art-board', 'art-copper-bottom'].map((c) => el('path', { class: c }, group));
  const lines = boardLayerLines();
  const out = [0, 0, 0];

  return {
    group,
    // Projected render for any pose and explode distance.
    render(pose, explode, cam) {
      group.removeAttribute('transform');
      const R = rotation(pose.yaw, pose.pitch, pose.roll || 0);
      // Draw back to front so the slab fill covers whatever lies behind it.
      lines.forEach((layer, i) => {
        const z = layerZ(i, explode);
        let d = '';
        for (const line of layer) {
          for (let j = 0; j < line.length; j++) {
            const q = projectPoint(line[j][0], line[j][1], z, pose, cam, R, out);
            d += (j ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1);
          }
        }
        paths[i].setAttribute('d', d);
        if (i === 2) fill.setAttribute('d', d + 'Z');
      });
    },
    setOpacity(v) { group.style.opacity = v; },
    setVisible(v) { group.style.display = v ? '' : 'none'; },
    remove() { group.remove(); },
  };
}
