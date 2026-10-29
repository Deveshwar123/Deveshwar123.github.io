// SVG rendering of the illustrated board through the shared camera model. Used
// by the story on narrow screens and as the NFC panel's fallback when WebGL is
// unavailable or busy. Same geometry and layer offsets as the WebGL board.

import { boardGeometry, pathFromPoints, BOARD } from './art.js';
import { rotation, projectPoint, layerZ } from './projection.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const circle = ([x, y], r, n = 12) => Array.from({ length: n + 1 }, (_, i) => [x + r * Math.cos((i / n) * Math.PI * 2), y + r * Math.sin((i / n) * Math.PI * 2)]);
let cache = null;

// Lines for the four visual construction groups: silkscreen, top copper,
// substrate edge, bottom copper.
export function boardLayerLines() {
  if (cache) return cache;
  const B = boardGeometry();
  const tc = B.topCopper;
  const chip = [[B.chip.x, B.chip.y], [B.chip.x + B.chip.w, B.chip.y], [B.chip.x + B.chip.w, B.chip.y + B.chip.h], [B.chip.x, B.chip.y + B.chip.h], [B.chip.x, B.chip.y]];
  cache = [
    [B.outline, ...B.silkscreen],
    [...B.antenna, ...B.busTraces.map((t) => t.pts), ...tc.feeds, ...tc.pinStubs, ...tc.ledTraces, chip, ...B.vias.map((v) => circle(v, 8))],
    [B.outline],
    [B.outline, ...B.bottomCopper, B.bridge],
  ];
  return cache;
}

// Rounded rings around the antenna coil on the board plane: the illustrative
// field shown on the NFC panel. Bounded to three rings.
export function fieldRings() {
  const rings = [];
  for (const grow of [36, 84, 140]) {
    const r = 40 + grow * 0.6;
    const x0 = -grow, y0 = -grow, x1 = BOARD.W + grow, y1 = BOARD.H + grow;
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
      const R = rotation(pose.yaw, pose.pitch);
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
    // Exact face-on render (board units under an SVG matrix): no projection error.
    renderFaceOn(m) {
      group.setAttribute('transform', `matrix(${m.map((v) => +v.toFixed(4)).join(' ')})`);
      paths[0].setAttribute('d', lines[0].map((l) => pathFromPoints(l)).join(''));
      paths[1].setAttribute('d', lines[1].map((l) => pathFromPoints(l)).join(''));
      paths[2].setAttribute('d', '');
      paths[3].setAttribute('d', '');
      fill.setAttribute('d', pathFromPoints(lines[2][0]) + 'Z');
    },
    setOpacity(v) { group.style.opacity = v; },
    setVisible(v) { group.style.display = v ? '' : 'none'; },
    remove() { group.remove(); },
  };
}
