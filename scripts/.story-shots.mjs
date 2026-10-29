// Usage: node .story-shots.mjs <outdir> <w> <h> <p1,p2,...>   env SCHEME
import { chromium } from '@playwright/test';
const [,, outDir, w = 1440, h = 900, ps = '0,0.09,0.18,0.3,0.48,0.595,0.62'] = process.argv;
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, colorScheme: process.env.SCHEME || 'dark' });
const page = await ctx.newPage();
page.on('console', m => { if (['error','warning'].includes(m.type())) console.log('console', m.type(), m.text()); });
page.on('pageerror', e => console.log('pageerror', e.message));
await page.goto('http://127.0.0.1:8080/');
await page.waitForTimeout(2600);
console.log('tier', await page.evaluate(() => document.documentElement.getAttribute('data-tier')));
for (const p of ps.split(',').map(Number)) {
  const y = await page.evaluate((p) => {
    const hero = document.querySelector('.hero');
    const vh = innerHeight; const startY = hero.getBoundingClientRect().top + scrollY;
    const full = document.documentElement.getAttribute('data-tier') === 'full';
    const trackH = full ? Math.max(2400, 4 * vh) : Math.max(1400, 3.2 * vh);
    return startY + (trackH - vh) * p / 0.62;
  }, p);
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${outDir}/story-${w}-p${p}.png` });
}
await browser.close();
