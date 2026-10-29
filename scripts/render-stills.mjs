// Maintenance: renders photoreal stills of the card with the site's own model
// (tools/stills.html) for the no-JS / reduced-motion frames, the NFC panel's
// fallback and the social card. Usage: node scripts/serve.mjs 8080 & node scripts/render-stills.mjs
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://127.0.0.1:8080/tools/stills.html');
await page.waitForFunction(() => window.stillsReady);
const stills = {
  'card-front': { w: 1600, h: 1000, ppu: 1.15, yaw: -16, pitch: -14 },
  'card-back': { w: 1600, h: 1000, ppu: 1.15, yaw: 196, pitch: -14 },
  'card-exploded': { w: 1600, h: 1100, ppu: 0.8, yaw: -27, pitch: -45, ty: -70, explode: 150 },
  'card-lit': { w: 1600, h: 1000, ppu: 1.15, yaw: -16, pitch: -14, led: 1 },
};
for (const [name, opts] of Object.entries(stills)) {
  const url = await page.evaluate((o) => window.renderStill(o), opts);
  writeFileSync(join(root, `assets/board/${name}.webp`), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', name);
}
await browser.close();
