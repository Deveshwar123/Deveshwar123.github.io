// Measures shipped bytes from what a real page load requests (Chrome via
// Playwright), gzip -9 per file, and writes reports/budget.md.
// Budgets (spec §13): app JS + Lenis + GSAP < 250KB gz (Three reported
// separately and in the total); initial transfer < 600KB; deferred Three < 250KB.
// Usage: node scripts/serve.mjs 8080 & node scripts/measure-budget.mjs
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.BASE || 'http://127.0.0.1:8080/';

async function collect(viewport) {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport, colorScheme: 'dark' });
  const seen = [];
  let loaded = false;
  page.on('load', () => { loaded = true; });
  page.on('request', (r) => { if (r.url().startsWith(base)) seen.push({ path: new URL(r.url()).pathname.replace(/^\//, '') || 'index.html', initial: !loaded }); });
  await page.goto(base);
  await page.waitForTimeout(3000);
  // Visit the rest of the page so every lazily loaded module is counted.
  for (const id of ['projects', 'skills', 'contact']) {
    await page.evaluate((id) => document.getElementById(id).scrollIntoView(), id);
    await page.waitForTimeout(700);
  }
  await browser.close();
  const unique = new Map();
  for (const s of seen) if (!unique.has(s.path) || s.initial) unique.set(s.path, s);
  return [...unique.values()];
}

const size = (p) => {
  const buf = readFileSync(join(root, p.endsWith('/') ? p + 'index.html' : p));
  return { raw: buf.length, gz: /\.(woff2|png)$/.test(p) ? buf.length : gzipSync(buf, { level: 9 }).length };
};
const kb = (n) => (n / 1024).toFixed(1);

const lines = ['# Byte budget', '', `Measured ${new Date().toISOString().slice(0, 10)} from the files a real Chrome load requests (gzip -9 per file; WOFF2/PNG counted as-is).`, ''];
let failures = 0;
for (const [name, viewport] of [['Desktop 1440×900 (full tier)', { width: 1440, height: 900 }], ['Mobile 390×844 (compact tier)', { width: 390, height: 844 }]]) {
  const files = (await collect(viewport)).map((f) => ({ ...f, ...size(f.path) }));
  const isThree = (p) => p.startsWith('vendor/three/');
  const isJs = (p) => /\.m?js$/.test(p);
  const appJs = files.filter((f) => isJs(f.path) && !isThree(f.path));
  const three = files.filter((f) => isThree(f.path));
  const initial = files.filter((f) => f.initial);
  const sum = (list) => list.reduce((a, f) => a + f.gz, 0);
  const rows = [
    ['JS excluding Three (app + Lenis + GSAP)', sum(appJs), 250 * 1024],
    ['Three.js subset (deferred)', sum(three), 250 * 1024],
    ['All JS including Three', sum(appJs) + sum(three), null],
    ['Initial transfer (before load: HTML, CSS, fonts, entry JS)', sum(initial), 600 * 1024],
    ['Everything requested', sum(files), null],
  ];
  lines.push(`## ${name}`, '', '| Measure | Size (gz) | Budget | Result |', '|---|---|---|---|');
  for (const [label, bytes, budget] of rows) {
    const ok = budget === null || bytes <= budget;
    if (!ok) failures++;
    lines.push(`| ${label} | ${kb(bytes)} KB | ${budget ? kb(budget) + ' KB' : '—'} | ${budget === null ? 'reported' : ok ? 'pass' : '**over**'} |`);
  }
  lines.push('', '<details><summary>Files</summary>', '', '| File | Raw | Gzip | Initial |', '|---|---|---|---|');
  for (const f of files.sort((a, b) => b.gz - a.gz)) lines.push(`| ${f.path} | ${kb(f.raw)} KB | ${kb(f.gz)} KB | ${f.initial ? 'yes' : ''} |`);
  lines.push('', '</details>', '');
}
mkdirSync(join(root, 'reports'), { recursive: true });
writeFileSync(join(root, 'reports/budget.md'), lines.join('\n'));
console.log(lines.filter((l) => l.startsWith('| ') && !l.includes('KB | yes') && !l.includes('| File')).slice(0, 14).join('\n'));
process.exit(failures ? 1 : 0);
