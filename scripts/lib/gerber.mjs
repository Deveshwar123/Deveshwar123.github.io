// Minimal RS-274X / Excellon reader for the card's EasyEDA exports: apertures,
// linear and circular interpolation (G75 multi-quadrant, I/J centre offsets),
// flashes, section comments, and drill hits. Coordinates are millimetres with
// y negative downward, exactly as exported.
import { readFileSync } from 'node:fs';

export function readGerber(file) {
  const src = readFileSync(file, 'utf8');
  const apertures = {};
  let scale = 1e5;
  let aperture = null, x = 0, y = 0, mode = 'G01', section = 'other', region = false;
  const lines = []; // { pts: [[x,y],...], aperture, section }
  const flashes = []; // { at: [x,y], aperture }
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    let m;
    if ((m = /%FSLAX(\d)(\d)Y/.exec(line))) scale = 10 ** +m[2];
    if ((m = /G04 (\w+) Start/.exec(line))) section = m[1];
    if ((m = /%ADD(\d+)([CRO]),([\d.]+)(?:X([\d.]+))?/.exec(line))) {
      apertures[m[1]] = { shape: m[2], w: +m[3], h: m[4] ? +m[4] : +m[3] };
      continue;
    }
    if (line.startsWith('G36')) region = true;
    if (line.startsWith('G37')) region = false;
    if ((m = /G54D(\d+)/.exec(line)) || (m = /^D(\d+)\*$/.exec(line))) if (+m[1] >= 10) aperture = m[1];
    if ((m = /^(G0[123])/.exec(line))) mode = m[1];
    const d = /D0([123])\*$/.exec(line);
    if (!d) continue;
    const nx = (m = /X(-?\d+)/.exec(line)) ? +m[1] / scale : x;
    const ny = (m = /Y(-?\d+)/.exec(line)) ? +m[1] / scale : y;
    if (d[1] === '1' && !region) {
      if (mode === 'G01') lines.push({ pts: [[x, y], [nx, ny]], aperture, section });
      else {
        const i = (m = /I(-?\d+)/.exec(line)) ? +m[1] / scale : 0;
        const j = (m = /J(-?\d+)/.exec(line)) ? +m[1] / scale : 0;
        lines.push({ pts: arc(x, y, nx, ny, x + i, y + j, mode === 'G02'), aperture, section });
      }
    }
    if (d[1] === '3') flashes.push({ at: [nx, ny], aperture, size: apertures[aperture] });
    x = nx; y = ny;
  }
  return { apertures, lines, flashes };
}

// Tessellate a circular arc from (x0,y0) to (x1,y1) around (cx,cy).
function arc(x0, y0, x1, y1, cx, cy, clockwise) {
  const r = Math.hypot(x0 - cx, y0 - cy);
  let a0 = Math.atan2(y0 - cy, x0 - cx), a1 = Math.atan2(y1 - cy, x1 - cx);
  if (clockwise) { while (a1 >= a0) a1 -= 2 * Math.PI; } else { while (a1 <= a0) a1 += 2 * Math.PI; }
  const n = Math.max(4, Math.ceil((Math.abs(a1 - a0) * r) / 0.15));
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const a = a0 + ((a1 - a0) * k) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  pts[pts.length - 1] = [x1, y1];
  return pts;
}

export function readDrill(file) {
  const tools = {};
  let tool = null;
  const hits = [];
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    let m;
    if ((m = /^T(\d+)C([\d.]+)/.exec(line))) { tools[m[1]] = +m[2]; continue; }
    if ((m = /^T(\d+)$/.exec(line))) { tool = m[1]; continue; }
    if ((m = /^X(-?[\d.]+)Y(-?[\d.]+)/.exec(line))) hits.push({ at: [+m[1], +m[2]], d: tools[tool] ?? Object.values(tools)[0] });
  }
  return hits;
}

// Join line pieces that share endpoints into the longest possible polylines.
export function chain(pieces, eps = 1e-3) {
  const key = ([x, y]) => `${Math.round(x / eps)},${Math.round(y / eps)}`;
  const ends = new Map();
  pieces.forEach((p, i) => {
    for (const end of [p[0], p[p.length - 1]]) {
      const k = key(end);
      if (!ends.has(k)) ends.set(k, []);
      ends.get(k).push(i);
    }
  });
  const used = new Set();
  const degree = (pt) => (ends.get(key(pt)) || []).length;
  const out = [];
  const order = [...pieces.keys()].sort((a, b) => Math.min(degree(pieces[a][0]), degree(pieces[a].at(-1))) - Math.min(degree(pieces[b][0]), degree(pieces[b].at(-1))));
  for (const start of order) {
    if (used.has(start)) continue;
    used.add(start);
    let poly = pieces[start].slice();
    if (degree(poly.at(-1)) === 1 && degree(poly[0]) !== 1) poly.reverse();
    for (let grow = true; grow;) {
      grow = false;
      const next = (ends.get(key(poly.at(-1))) || []).find((i) => !used.has(i));
      if (next !== undefined) {
        used.add(next);
        let p = pieces[next];
        if (key(p[0]) !== key(poly.at(-1))) p = p.slice().reverse();
        poly = poly.concat(p.slice(1));
        grow = true;
      }
    }
    for (let grow = true; grow;) {
      grow = false;
      const prev = (ends.get(key(poly[0])) || []).find((i) => !used.has(i));
      if (prev !== undefined) {
        used.add(prev);
        let p = pieces[prev];
        if (key(p.at(-1)) !== key(poly[0])) p = p.slice().reverse();
        poly = p.slice(0, -1).concat(poly);
        grow = true;
      }
    }
    out.push(poly);
  }
  return out;
}
