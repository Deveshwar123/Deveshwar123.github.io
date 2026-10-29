// Maintenance: turns the card's real fabrication files (hardware/gerbers/) into
//  1. js/board-data.js — exact geometry (outline, five antenna turns, traces,
//     pads, vias, parts) in board units for the line art and the morph;
//  2. assets/board/*.webp — physically based texture maps rendered from the
//     layers with pcb-stackup: colour, roughness/metalness and relief per side,
//     plus the top silkscreen on its own for the exploded view.
// Usage: node scripts/build-board.mjs   (needs Chrome via Playwright for step 2)
import { readdirSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { readGerber, readDrill, chain } from './lib/gerber.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const G = (f) => join(root, 'hardware/gerbers', f);

// ---------------------------------------------------------------------------
// 1. Geometry
// ---------------------------------------------------------------------------
const W_MM = 88.9, H_MM = 50.8, S = 1120 / W_MM; // board units per mm (y down)
const toB = ([x, y]) => [+(x * S).toFixed(2), +(-y * S).toFixed(2)];

const top = readGerber(G('Gerber_TopLayer.GTL'));
const bottom = readGerber(G('Gerber_BottomLayer.GBL'));
const outlineG = readGerber(G('Gerber_BoardOutlineLayer.GKO'));
const drills = [...readDrill(G('Drill_PTH_Through.DRL')), ...readDrill(G('Drill_PTH_Through_Via.DRL'))];

// Board outline: one closed loop, re-started at bottom centre heading left so it
// pairs with the jali frame.
let outline = chain(outlineG.lines.map((l) => l.pts))[0].map(toB);
{
  if (Math.hypot(outline[0][0] - outline.at(-1)[0], outline[0][1] - outline.at(-1)[1]) < 0.01) outline.pop();
  // Insert the bottom-centre point on the bottom edge and rotate to start there.
  const H = H_MM * S, CX = (W_MM * S) / 2;
  const i = outline.findIndex((p, k) => { const q = outline[(k + 1) % outline.length]; return Math.abs(p[1] - H) < 0.5 && Math.abs(q[1] - H) < 0.5 && (p[0] - CX) * (q[0] - CX) <= 0; });
  outline = [[CX, H], ...outline.slice(i + 1), ...outline.slice(0, i + 1)];
  if (outline[1][0] > CX) outline = [outline[0], ...outline.slice(1).reverse()];
  outline.push([CX, H]);
}

// Antenna: chain the 0.3mm coil copper into one spiral, then split it into its
// five turns at the 45° crossover jogs on the left side.
const coilPieces = top.lines.filter((l) => l.section === 'PolygonModel').map((l) => l.pts);
const spiral = chain(coilPieces).sort((a, b) => b.length - a.length)[0];
const cuts = [];
for (let i = 1; i < spiral.length; i++) {
  const [ax, ay] = spiral[i - 1], [bx, by] = spiral[i];
  const dx = Math.abs(bx - ax), dy = Math.abs(by - ay);
  if (ax < 66 && dx > 0.4 && Math.abs(dx - dy) < 0.05) cuts.push(i);
}
const turns = [];
let from = 0;
for (const c of [...cuts, spiral.length]) { turns.push(spiral.slice(from, c)); from = c - 1; }
// Clockwise on screen (y down), like the arch lines they pair with.
const signedArea = (pts) => pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + (p[0] * q[1] - q[0] * p[1]); }, 0);
const antenna = turns.map((t) => { const b = t.map(toB); return signedArea(b) < 0 ? b.reverse() : b; });

// Traces (0.254mm tracks), each tagged left/right of the board's centre line.
const traces = chain(top.lines.filter((l) => l.section === 'Track').map((l) => l.pts))
  .map((p) => p.map(toB))
  .sort((a, b) => a[0][0] - b[0][0])
  .map((pts, i) => {
    const mid = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    return { id: `${mid < (W_MM * S) / 2 ? 'l' : 'r'}${i}`, pts };
  });

const pads = top.flashes.filter((f) => f.size).map((f) => {
  const [x, y] = toB(f.at);
  return { x, y, w: +(f.size.w * S).toFixed(2), h: +(f.size.h * S).toFixed(2), shape: f.size.shape === 'C' ? 'circle' : 'rect' };
});
const vias = drills.map((d) => ({ at: toB(d.at), r: +((d.d / 2) * S).toFixed(2) }));
const bridge = chain(bottom.lines.map((l) => l.pts)).map((p) => p.map(toB));

// Parts from the BOM, placed at their pad centres (mm → board units).
const centre = (list) => toB([list.reduce((s, f) => s + f.at[0], 0) / list.length, list.reduce((s, f) => s + f.at[1], 0) / list.length]);
const near = (x, y, r) => top.flashes.filter((f) => Math.hypot(f.at[0] - x, f.at[1] - y) < r);
const parts = {
  U1: { at: centre(near(50.42, -26.04, 0.9)), w: 1.6 * S, h: 1.6 * S, d: 0.55 * S, kind: 'qfn', name: 'NXP NT3H2111 (XQFN-8)' },
  LED1: { at: centre(near(4.95, -3.94, 1.3)), w: 2.0 * S, h: 1.25 * S, d: 0.8 * S, kind: 'led', name: 'KT-0805Y yellow LED (0805)' },
  R3: { at: centre(near(42.93, -25.9, 0.9)), w: 0.8 * S, h: 1.6 * S, d: 0.45 * S, kind: 'resistor', name: '47 Ω resistor (0603)' },
  C1: { at: centre(near(45.97, -25.91, 0.9)), w: 0.8 * S, h: 1.6 * S, d: 0.8 * S, kind: 'capacitor', name: '220 nF capacitor (0603)' },
};

const data = {
  source: 'hardware/gerbers (EasyEDA Pro export, fabricated by JLCPCB)',
  mm: { width: W_MM, height: H_MM, thickness: 1.6, unitsPerMm: +S.toFixed(5) },
  outline, antenna, traces, pads, vias, bridge, parts,
};
writeFileSync(join(root, 'js/board-data.js'),
  `// Generated by scripts/build-board.mjs from the card's real Gerber files. Do not edit.\n// Board units: 1120 × 640 for 88.9 × 50.8 mm, y down.\nexport const REAL_BOARD = ${JSON.stringify(data)};\n`);
console.log(`geometry: ${antenna.length} antenna turns, ${traces.length} traces, ${pads.length} pads, ${vias.length} vias`);

// ---------------------------------------------------------------------------
// 2. Texture maps
// ---------------------------------------------------------------------------
if (process.argv.includes('--geometry-only')) process.exit(0);
const pcbStackup = require('pcb-stackup');
const layers = readdirSync(join(root, 'hardware/gerbers'))
  .filter((f) => !/Document|DrillDrawing/.test(f))
  .map((f) => ({ filename: f, gerber: readFileSync(G(f), 'utf8') }));

// Each scheme colours the same layers differently; one render per scheme.
const T = 'rgba(0,0,0,0)';
const schemes = {
  // Albedo: black solder mask, faintly visible copper beneath it, silver HASL, white silk.
  color: { fr4: '#2a2519', cu: '#5b4a30', cf: '#cfcfcc', sm: 'rgba(11,13,12,0.9)', ss: '#efede5', sp: T, out: T },
  colorNoSilk: { fr4: '#2a2519', cu: '#5b4a30', cf: '#cfcfcc', sm: 'rgba(11,13,12,0.9)', ss: T, sp: T, out: T },
  silk: { fr4: T, cu: T, cf: T, sm: T, ss: '#efede5', sp: T, out: T },
  // ORM (glTF convention): R = occlusion, G = roughness, B = metalness. The top
  // map leaves silk out (it is its own plane); the back keeps it.
  orm: { fr4: 'rgb(255,128,0)', cu: 'rgb(255,112,0)', cf: 'rgb(255,70,255)', sm: T, ss: 'rgb(255,215,0)', sp: T, out: T },
  ormNoSilk: { fr4: 'rgb(255,128,0)', cu: 'rgb(255,112,0)', cf: 'rgb(255,70,255)', sm: T, ss: T, sp: T, out: T },
  // Relief of the mask surface: copper (and the mask over it) stands proud, HASL
  // highest. Silk is its own plane, so it is not part of this map.
  height: { fr4: '#000', cu: '#7a7a7a', cf: '#a0a0a0', sm: T, ss: T, sp: T, out: T },
};

const out = join(root, 'assets/board');
mkdirSync(out, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'board-'));
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const sizes = [[2048, 'hi'], [1024, 'lo']];
for (const [name, color] of Object.entries(schemes)) {
  const stack = await pcbStackup(layers, { color, maskWithOutline: true });
  const sides = ['silk', 'colorNoSilk', 'height', 'ormNoSilk'].includes(name) ? ['top'] : name === 'orm' ? ['bottom'] : ['top', 'bottom'];
  for (const side of sides) {
    const svg = stack[side].svg;
    writeFileSync(join(tmp, 'layer.svg'), svg);
    for (const [px, tag] of sizes) {
      if (tag === 'lo' && name === 'height') continue; // relief only at full size
      const h = Math.round((px * H_MM) / W_MM);
      const url = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
      const webp = await page.evaluate(async ({ url, px, h, opaque }) => {
        const img = new Image();
        img.src = url;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = px; c.height = h;
        const ctx = c.getContext('2d');
        if (opaque) { ctx.fillStyle = opaque; ctx.fillRect(0, 0, px, h); }
        ctx.drawImage(img, 0, 0, px, h);
        return c.toDataURL('image/webp', 0.9);
      }, { url, px, h, opaque: name === 'height' ? '#000' : null });
      const file = `${side}-${name}-${tag}.webp`;
      writeFileSync(join(out, file), Buffer.from(webp.split(',')[1], 'base64'));
    }
  }
}
await browser.close();
rmSync(tmp, { recursive: true });
console.log('textures:', readdirSync(out).filter((f) => f.endsWith('.webp')).length, 'files in assets/board/');
