// Maintenance script: writes the static, inspectable SVG artwork in assets/svg/
// from the shared geometry in js/art.js. The generator inlines these files as
// <symbol>s; the browser regenerates the same geometry live for the scroll story.
// Usage: node scripts/build-art.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOARD, boardGeometry, jaliGeometry, pathFromPoints, smoothPathFromPoints, globeGeometry, circlePoints, rosette } from '../js/art.js';
import { makeCamera, projectPolyline, rotation } from '../js/projection.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (rel, svg) => {
  const p = join(root, 'assets/svg', rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, svg);
};

// Standalone files carry presentation attributes so they render when opened
// directly; the generator drops the root attributes and styles them with CSS.
const svg = (viewBox, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="#c98a4b" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">\n${body}\n</svg>\n`;
const paths = (list, attrs = '') => list.map((pts) => `<path${attrs} d="${pathFromPoints(pts)}"/>`).join('\n');
// Curved artwork (lattice, arches, ornament, globe) is written as smooth Béziers.
const curves = (list) => list.map((pts) => `<path d="${smoothPathFromPoints(pts)}"/>`).join('\n');
const curve = (pts) => smoothPathFromPoints(pts);
const g = (cls, body) => `<g class="${cls}">\n${body}\n</g>`;

// --- Jali arch variants (reference layouts for the no-JS hero and inspection) ---
function jaliSvg(frame, box, maxPairs) {
  const j = jaliGeometry(frame, box, { maxPairs });
  const body = [
    g('art-frame', `<path d="${pathFromPoints(j.frame)}"/>`),
    g('art-arches', j.arches.map((a, k) => `<path data-pair="arch-${k}" d="${curve(a)}"/>`).join('\n')),
    g('art-waves', j.waves.map((w, i) => `<path data-pair="wave-${i}" d="${curve(w.pts)}"/>`).join('\n')),
    g('art-ornament', curves(j.ornament)),
  ].join('\n');
  return svg(`0 0 ${frame.w} ${frame.h}`, body);
}
out('jali-arch-wide.svg', jaliSvg({ x: 0, y: 0, w: 1280, h: 600 }, { x: 250, y: 250, w: 780, h: 290 }, 3));
out('jali-arch-tall.svg', jaliSvg({ x: 0, y: 0, w: 358, h: 470 }, { x: 30, y: 150, w: 298, h: 280 }, 1));
out('jali-panel.svg', jaliSvg({ x: 0, y: 0, w: 640, h: 440 }, { x: 210, y: 196, w: 220, h: 200 }, 2));
out('closing-jali.svg', jaliSvg({ x: 0, y: 0, w: 960, h: 240 }, { x: 340, y: 150, w: 280, h: 80 }, 4));

// --- Board, face-on: the real card's copper as line art (from js/board-data.js) ---
const B = boardGeometry();
function boardFaceBody() {
  return [
    g('art-board', `<path class="art-board-edge" d="${pathFromPoints(B.outline)}"/>`),
    g('art-silk', paths(B.partOutlines)),
    g('art-antenna', B.antenna.map((t, k) => `<path data-pair="arch-${k}" d="${pathFromPoints(t)}"/>`).join('\n')),
    g('art-traces', B.busTraces.map((t, i) => `<path data-pair="wave-${i}" d="${pathFromPoints(t.pts)}"/>`).join('\n')),
    g('art-pads', paths(B.padPolys)),
    g('art-vias', paths(B.viaRings)),
  ].join('\n');
}
out('traces.svg', svg(`0 0 ${BOARD.W} ${BOARD.H}`, boardFaceBody()));

// --- Board, exploded line art (inspectable reference for the four groups) ---
function explodedSvg() {
  const vw = 1200, vh = 820;
  const cam = makeCamera(vw, vh, 0.72);
  const pose = { yaw: (-22 * Math.PI) / 180, pitch: (-56 * Math.PI) / 180, tx: 0, ty: -90 };
  const R = rotation(pose.yaw, pose.pitch);
  const d = 110;
  const layers = [
    { cls: 'art-silk', z: 3 * d, lines: [B.outline, ...B.partOutlines] },
    { cls: 'art-traces', z: d, lines: [B.outline, ...B.antenna, ...B.busTraces.map((t) => t.pts), ...B.padPolys] },
    { cls: 'art-board', z: 0, lines: [B.outline] },
    { cls: 'art-copper-bottom', z: -d, lines: [B.outline, ...B.bridge, ...B.viaRings] },
  ];
  const body = layers.map((L) => g(L.cls, L.lines.map((pts) => `<path d="${pathFromPoints(projectPolyline(pts, L.z, pose, cam, R))}"/>`).join('\n'))).join('\n');
  return svg(`0 0 ${vw} ${vh}`, body);
}
out('board-layers.svg', explodedSvg());

// --- TideCast globe with a schematic ping at College Station (30.6° N, 96.3° W) ---
{
  const globe = globeGeometry(200, 200, 168, { lon0: -88, lat0: 24 });
  const cs = globe.project(30.6, -96.3);
  const body = [
    g('art-globe', [`<path d="${curve(globe.outline)}"/>`, curves(globe.lines)].join('\n')),
    g('art-ping', [
      `<circle cx="${cs.x.toFixed(2)}" cy="${cs.y.toFixed(2)}" r="4"/>`,
      `<circle class="art-ping-ring" cx="${cs.x.toFixed(2)}" cy="${cs.y.toFixed(2)}" r="12"/>`,
      `<circle class="art-ping-ring" cx="${cs.x.toFixed(2)}" cy="${cs.y.toFixed(2)}" r="22"/>`,
    ].join('\n')),
  ].join('\n');
  out('tidecast-globe.svg', svg('0 0 400 400', body));
}

// --- Vedam: an original jali arch, drawn then filled ---
{
  const j = jaliGeometry({ x: 0, y: 0, w: 400, h: 400 }, { x: 120, y: 190, w: 160, h: 180 }, { maxPairs: 1, gap: 7, riseRatio: 0.9 });
  const inner = j.arches[j.arches.length - 1];
  const body = [
    g('art-vedam-fill', `<path class="art-fill" d="${pathFromPoints(inner)}Z"/>`),
    g('art-frame', `<path d="${pathFromPoints(j.frame)}"/>`),
    g('art-arches', curves(j.arches)),
    g('art-waves', curves(j.waves.map((w) => w.pts))),
    g('art-ornament', curves(j.ornament)),
    g('art-vedam-rosette', curves(rosette(200, 300, 38))),
  ].join('\n');
  out('vedam-arch.svg', svg('0 0 400 400', body));
}

// --- Glyphs: 24 × 24, one consistent stroke family ---
const glyphs = {
  arch: 'M5 21V11a7 7 0 0 1 14 0v10M9 21v-8a3 3 0 0 1 6 0v8M3 21h18',
  chip: 'M7 7h10v10H7zM10 4v3M14 4v3M10 17v3M14 17v3M4 10h3M4 14h3M17 10h3M17 14h3',
  scatter: 'M4 4v16h16M8 15h.01M11 11h.01M14 13h.01M17 7h.01M8 15l3-4 3 2 3-6',
  candles: 'M6 6v12M10 4v16M14 8v8M18 5v12M5 9h2v6H5zM9 7h2v8H9zM13 10h2v4h-2zM17 8h2v6h-2z',
  board: 'M4 6h16v12H4zM7 9h4v6H7zM14 9h3M14 12h3M14 15h3M2 9h2M2 15h2',
  speech: 'M4 5h16v10H10l-4 4v-4H4zM8 9h8M8 12h5',
  viola: 'M14 3l-2 6M12 9c-3 0-5 2-4 4s-1 3-1 5 3 3 5 1 4 0 5-2-1-4-1-5 1-3-4-3zM10 13h3',
  triathlon: 'M5 19a2 2 0 1 0 0 .01M19 19a2 2 0 1 0 0 .01M5 19l4-7h6l4 7M12 12l-2-5h4M3 7c2 1 4 1 6 0',
  chess: 'M9 20h6M8 17h8l-1-6h-6zM10 11V9l-2-2 2-3h4l2 3-2 2v2',
  cooking: 'M4 11h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6zM2 11h2M20 11h2M9 8c0-2 2-2 2-4M13 8c0-2 2-2 2-4',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5H5V6h5',
  copy: 'M8 8h11v12H8zM5 16H4V4h12v1',
  check: 'M5 12l5 5 9-10',
  'arrow-down': 'M12 4v15M6 13l6 6 6-6',
  arrow: 'M4 12h15M13 6l6 6-6 6',
  pause: 'M8 5v14M16 5v14',
  play: 'M7 5l12 7-12 7z',
  'rotate-left': 'M4 9V4M4 9h5M4.8 9A8 8 0 1 1 6 16',
  'rotate-right': 'M20 9V4M20 9h-5M19.2 9A8 8 0 1 0 18 16',
  reset: 'M12 4v4M12 16v4M4 12h4M16 12h4M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  monogram: 'M3 6h5l3 3v6l-3 3H3zM13 6l4 12 4-12',
  field: 'M12 12h.01M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8',
};
for (const [name, d] of Object.entries(glyphs)) out(`glyphs/${name}.svg`, svg('0 0 24 24', `<path d="${d}"/>`));

// --- Favicon: the DV monogram inside the antenna square ---
writeFileSync(join(root, 'assets/favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#06121e"/><g fill="none" stroke="#c98a4b" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h22v22H5z" opacity=".55"/><path d="M8 11h4l2 2v6l-2 2H8zM17 11l3 10 3-10"/></g></svg>\n`);

console.log('art written:', Object.keys(glyphs).length, 'glyphs + 8 illustrations');
void circlePoints;
