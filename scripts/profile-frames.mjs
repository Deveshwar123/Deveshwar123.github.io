// Frame-time profile: a 10s forward/back wheel scroll through the story and an
// NFC drag, recording requestAnimationFrame intervals and long tasks.
// Usage: node scripts/serve.mjs 8080 & node scripts/profile-frames.mjs
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
await page.goto('http://127.0.0.1:8080/');
await page.waitForTimeout(2500);
const start = () => page.evaluate(() => {
  window.__f = []; window.__lt = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(e.duration); }).observe({ type: 'longtask' });
  let last = performance.now();
  const tick = (t) => { window.__f.push(t - last); last = t; if (!window.__stop) requestAnimationFrame(tick); };
  window.__stop = false; requestAnimationFrame(tick);
});
const stop = () => page.evaluate(() => { window.__stop = true; return { f: window.__f.slice(2), lt: window.__lt }; });
const stats = ({ f, lt }) => {
  const s = [...f].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { frames: f.length, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), max: +s[s.length - 1].toFixed(1), over16_7: +(f.filter((x) => x > 16.7 * 1.5).length / f.length * 100).toFixed(1) + '%', longTasks: lt.length, longestTask: lt.length ? Math.round(Math.max(...lt)) : 0 };
};

await start();
const t0 = Date.now();
await page.mouse.move(700, 450);
while (Date.now() - t0 < 5000) { await page.mouse.wheel(0, 120); await page.waitForTimeout(40); }
while (Date.now() - t0 < 10000) { await page.mouse.wheel(0, -120); await page.waitForTimeout(40); }
console.log('story scroll 10s:', JSON.stringify(stats(await stop())));

await page.evaluate(() => document.getElementById('project-nfc-card').scrollIntoView());
await page.waitForTimeout(1500);
const box = await page.locator('[data-nfc-view]').boundingBox();
await start();
for (let i = 0; i < 4; i++) {
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2 + 10, { steps: 30 });
  await page.mouse.up();
  await page.waitForTimeout(600);
}
console.log('NFC drag:', JSON.stringify(stats(await stop())));
await browser.close();
