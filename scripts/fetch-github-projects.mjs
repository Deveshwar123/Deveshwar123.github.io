// Maintenance: for each repo in data/github-projects.json, saves its README at the
// pinned commit and GitHub's language stats to tests/fixtures/github/<id>/ (the
// unit tests check every card against them), and writes the repo's screenshot as
// two WebP sizes to assets/projects/<id>-<width>.webp.
// Usage: node scripts/fetch-github-projects.mjs
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shotWidths } from './lib/repo-windows.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { items } = JSON.parse(readFileSync(join(root, 'data/github-projects.json'), 'utf8'));
const UA = 'PortfolioBuild/1.0 (github.com/Deveshwar123)';

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
for (const p of items) {
  const name = new URL(p.repo).pathname.split('/')[2];
  const raw = (path) => `https://raw.githubusercontent.com/Deveshwar123/${name}/${p.commit}/${path}`;
  const dir = join(root, 'tests/fixtures/github', p.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'README.md'), await get(raw('README.md')));
  const langs = JSON.parse(await get(`https://api.github.com/repos/Deveshwar123/${name}/languages`));
  writeFileSync(join(dir, 'languages.json'), JSON.stringify(langs, null, 2) + '\n');

  if (p.picture.kind === 'shot') {
    const png = await get(raw(p.picture.path));
    for (const w of shotWidths(p.picture)) {
      const webp = await page.evaluate(async ({ b64, w, pw, ph }) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        await img.decode();
        if (img.naturalWidth !== pw || img.naturalHeight !== ph) throw new Error(`expected ${pw}×${ph}, got ${img.naturalWidth}×${img.naturalHeight}`);
        const c = document.createElement('canvas');
        c.width = w; c.height = Math.round((w * ph) / pw);
        const ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/webp', 0.8);
      }, { b64: png.toString('base64'), w, pw: p.picture.width, ph: p.picture.height });
      writeFileSync(join(root, `assets/projects/${p.id}-${w}.webp`), Buffer.from(webp.split(',')[1], 'base64'));
    }
  }
  console.log('fetched', p.id);
}
await browser.close();
