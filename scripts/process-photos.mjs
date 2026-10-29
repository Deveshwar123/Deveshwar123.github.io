// Maintenance: downloads the credited Wikimedia Commons photos listed in
// data/site-config.json → photos, crops each around its focus point to its
// aspect ratio and writes two WebP sizes to assets/photos/.
// Usage: node scripts/process-photos.mjs
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'data/site-config.json'), 'utf8'));
const UA = 'PortfolioBuild/1.0 (github.com/Deveshwar123)';

async function thumbUrl(title, width) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=${width}&titles=${encodeURIComponent(title)}`;
  const res = await fetch(api, { headers: { 'User-Agent': UA } });
  const page = Object.values((await res.json()).query.pages)[0];
  return page.imageinfo[0].thumburl;
}

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
for (const [id, p] of Object.entries(cfg.photos.items)) {
  const url = await thumbUrl(p.file, 2000);
  const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  const [aw, ah] = p.aspect;
  const widths = aw > ah ? [1600, 800] : [720, 420];
  for (const w of widths) {
    const h = Math.round((w * ah) / aw);
    const webp = await page.evaluate(async ({ b64, w, h, focus, zoom }) => {
      const img = new Image();
      img.src = 'data:image/jpeg;base64,' + b64;
      await img.decode();
      // Largest crop of the target aspect, centred on the focus point.
      const target = w / h;
      let cw = img.naturalWidth, ch = cw / target;
      if (ch > img.naturalHeight) { ch = img.naturalHeight; cw = ch * target; }
      cw /= zoom; ch /= zoom; // optional tighter crop around the focus point
      const sx = Math.min(img.naturalWidth - cw, Math.max(0, focus[0] * img.naturalWidth - cw / 2));
      const sy = Math.min(img.naturalHeight - ch, Math.max(0, focus[1] * img.naturalHeight - ch / 2));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, cw, ch, 0, 0, w, h);
      return c.toDataURL('image/webp', 0.8);
    }, { b64: buf.toString('base64'), w, h, focus: p.focus, zoom: p.zoom || 1 });
    writeFileSync(join(root, `assets/photos/${id}-${w}.webp`), Buffer.from(webp.split(',')[1], 'base64'));
  }
  console.log('processed', id);
}
await browser.close();
