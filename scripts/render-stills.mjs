// Maintenance: renders photoreal stills of the card with the site's own model
// (tools/stills.html) for the no-JS / reduced-motion frames, the NFC panel's
// fallback and the social card. Usage: node scripts/serve.mjs 8080 & node scripts/render-stills.mjs
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// The hero still uses the live hero pose and size, so the swap to the 3D card is seamless.
const H = JSON.parse(readFileSync(join(root, 'data/site-config.json'), 'utf8')).journey.hero;
const heroPose = { yaw: H.yawDeg, pitch: H.pitchDeg, roll: H.rollDeg };
const BOARD_W = 1120;
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://127.0.0.1:8080/tools/stills.html');
await page.waitForFunction(() => window.stillsReady);
const stills = {
  'card-front': { w: 1600, h: 1000, ppu: 1.15, yaw: -16, pitch: -14 },
  // The engraving's fine detail is costly; a slightly lower quality halves the file.
  'card-back': { w: 1600, h: 1000, ppu: 1.15, yaw: 196, pitch: -14, quality: 0.74 },
  'card-exploded': { w: 1600, h: 1100, ppu: 0.8, yaw: -27, pitch: -45, ty: -70, explode: 150 },
  'card-lit': { w: 1600, h: 1000, ppu: 1.15, yaw: -16, pitch: -14, led: 1 },
  // The hero's still (no JS, reduced motion, and the first paint before the 3D card).
  'card-hero': { w: 1600, h: 1100, ppu: (1600 * H.widthRatio) / BOARD_W, ...heroPose },
  'card-hero-800': { w: 800, h: 550, ppu: (800 * H.widthRatio) / BOARD_W, ...heroPose },
};
for (const [name, opts] of Object.entries(stills)) {
  const url = await page.evaluate((o) => window.renderStill(o), opts);
  writeFileSync(join(root, `assets/board/${name}.webp`), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', name);
}
await browser.close();
