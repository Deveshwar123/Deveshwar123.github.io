// Maintenance: renders the 1200×630 Open Graph image to match the hero: the name
// and major on the left, a render of the real NFC card in a soft studio light on
// the right, using the self-hosted fonts.
// Usage: node scripts/serve.mjs 8080 & node scripts/render-stills.mjs && node scripts/build-social.mjs
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const resume = JSON.parse(readFileSync(join(root, 'data/resume.json'), 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fontUrl = (f) => 'data:font/woff2;base64,' + readFileSync(join(root, 'assets/fonts', f)).toString('base64');
const [first, ...rest] = resume.person.name.split(' ');
const edu = resume.education[0];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: N; src: url(${fontUrl('newsreader-latin-var.woff2')}) format('woff2'); font-weight: 400 600; }
@font-face { font-family: D; src: url(${fontUrl('dm-sans-latin-var.woff2')}) format('woff2'); font-weight: 400 600; }
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #0b0c0e; }
body {
  background:
    radial-gradient(ellipse 34% 46% at 72% 50%, rgb(255 246 232 / 0.2), transparent 72%),
    radial-gradient(ellipse 46% 30% at 76% 88%, rgb(201 138 75 / 0.09), transparent 70%),
    #0b0c0e;
}
.grid { position: absolute; inset: 0; background-image: linear-gradient(rgb(255 255 255 / 0.05) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.05) 1px, transparent 1px); background-size: 56px 56px; -webkit-mask-image: radial-gradient(ellipse 50% 62% at 72% 50%, #000 15%, transparent 78%); }
.card { position: absolute; right: 18px; top: 92px; width: 640px; height: auto; filter: drop-shadow(0 34px 34px rgb(0 0 0 / 0.5)); }
.text { position: absolute; left: 72px; top: 150px; width: 520px; color: #f2f1ee; }
.k { font: 500 15px D, Arial, sans-serif; letter-spacing: .22em; text-transform: uppercase; color: #c98a4b; margin: 0 0 18px; }
h1 { font: 450 84px/0.96 N, Georgia, serif; letter-spacing: -0.035em; margin: 0; }
h1 span { display: block; } h1 span + span { color: #d2d1cd; }
p { font: 400 24px/1.4 D, Arial, sans-serif; margin: 28px 0 0; color: #d2d1cd; }
</style></head><body>
<div class="grid"></div>
<img class="card" src="${'data:image/webp;base64,' + readFileSync(join(root, 'assets/board/card-hero.webp')).toString('base64')}">
<div class="text"><div class="k">Portfolio</div><h1><span>${esc(first)}</span><span>${esc(rest.join(' '))}</span></h1><p>${esc(edu.degree.replace('B.S. ', ''))} · ${esc(edu.institution)}</p></div>
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
