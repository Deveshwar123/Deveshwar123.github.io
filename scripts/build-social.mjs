// Maintenance: renders the 1200×630 Open Graph image from the site's own line
// art (the illustrated board and a jali arch) with the name and major, using the
// self-hosted fonts. The PNG is a derivative export, not a new illustration style.
// Usage: node scripts/serve.mjs 8080 & node scripts/build-social.mjs
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jaliGeometry, pathFromPoints } from '../js/art.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const resume = JSON.parse(readFileSync(join(root, 'data/resume.json'), 'utf8'));
const inner = (rel) => readFileSync(join(root, rel), 'utf8').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fontUrl = (f) => 'data:font/woff2;base64,' + readFileSync(join(root, 'assets/fonts', f)).toString('base64');

const jali = jaliGeometry({ x: 24, y: 24, w: 560, h: 582 }, { x: 110, y: 250, w: 388, h: 250 }, { maxPairs: 1 });
const arch = [jali.frame, ...jali.arches, ...jali.waves.map((w) => w.pts)].map((l) => `<path d="${pathFromPoints(l)}"/>`).join('');
const orn = jali.ornament.map((l) => `<path d="${pathFromPoints(l)}"/>`).join('');
const [first, ...rest] = resume.person.name.split(' ');
const edu = resume.education[0];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: N; src: url(${fontUrl('newsreader-latin-var.woff2')}) format('woff2'); font-weight: 400 600; }
@font-face { font-family: D; src: url(${fontUrl('dm-sans-latin-var.woff2')}) format('woff2'); font-weight: 400 600; }
html, body { margin: 0; width: 1200px; height: 630px; background: #06121e; overflow: hidden; }
svg { position: absolute; fill: none; stroke-linecap: round; stroke-linejoin: round; }
svg path, svg circle, svg rect { vector-effect: non-scaling-stroke; stroke-width: 1.6; }
.arch { left: 0; top: 0; width: 608px; height: 630px; stroke: #c98a4b; }
.arch .orn { stroke: #d9b36a; }
.board { right: 40px; top: 150px; width: 560px; height: 320px; }
.board .art-silk { stroke: rgba(243,234,220,.6); } .board .art-traces, .board .art-antenna, .board .art-copper-extra { stroke: #c98a4b; }
.board .art-vias, .board .art-pads { stroke: #d9b36a; } .board .art-board, .board .art-chip { stroke: rgba(159,176,189,.6); }
.board .art-board-edge { fill: #0b1a14; }
.text { position: absolute; left: 0; width: 608px; top: 286px; text-align: center; color: #f3eadc; }
h1 { font: 500 58px/0.95 N, Georgia, serif; letter-spacing: -0.02em; margin: 0; text-transform: uppercase; }
p { font: 500 23px/1.4 D, Arial, sans-serif; margin: 22px 0 0; color: #d8cfc1; }
.k { font: 500 14px D, Arial, sans-serif; letter-spacing: .24em; text-transform: uppercase; color: #c98a4b; margin: 0 0 16px; }
</style></head><body>
<svg class="arch" viewBox="0 0 608 630">${arch}<g class="orn">${orn}</g></svg>
<svg class="board" viewBox="0 0 1120 640">${inner('assets/svg/traces.svg')}</svg>
<div class="text"><div class="k">Tradition → Circuit</div><h1>${esc(first)}<br>${esc(rest.join(' '))}</h1><p>${esc(edu.degree.replace('B.S. ', ''))} · ${esc(edu.institution)}</p></div>
</body></html>`;

const dir = mkdtempSync(join(tmpdir(), 'social-'));
writeFileSync(join(dir, 'card.html'), html);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto('file://' + join(dir, 'card.html'));
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(root, 'assets/social-card.png') });
await browser.close();
rmSync(dir, { recursive: true });
console.log('wrote assets/social-card.png');
