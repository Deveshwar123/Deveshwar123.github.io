// Maintenance: captures the owner's live project sites for the device mockups
// (desktop 1440×900 and phone 390×844), saved as WebP in assets/projects/.
// Names of other people shown on a live page (TideCast's top-catch teaser) are
// blurred in the page before capture.
// Usage: node scripts/capture-projects.mjs
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Render's free tier shows a "waking up" page first; Vedam opens on a splash.
const isWaking = (page) => page.evaluate(() => /SERVICE WAKING UP|APPLICATION LOADING|Welcome to Render/i.test(document.body.innerText));
const sites = [
  { id: 'tidecast', url: 'https://tidecast-kdl9.onrender.com/backbone/', async ready(page) {
    for (let i = 0; i < 24 && (await isWaking(page)); i++) { await page.waitForTimeout(5000); if (i % 4 === 3) await page.reload({ waitUntil: 'load' }); }
  }, async redact(page) {
    // The "top catch" teaser names a leaderboard user ("Name · Place · pts"): blur the name.
    await page.evaluate(() => {
      const sub = document.getElementById('teaser-sub');
      const text = sub?.firstChild;
      if (!text || text.nodeType !== Node.TEXT_NODE) return;
      const cut = text.data.indexOf(' · ');
      if (cut <= 0) return;
      const name = document.createElement('span');
      name.textContent = text.data.slice(0, cut);
      name.style.filter = 'blur(5px)';
      text.data = text.data.slice(cut);
      sub.prepend(name);
    });
  } },
  { id: 'vedam', url: 'https://wearvedam.com', async ready(page) {
    const vp = page.viewportSize();
    await page.mouse.click(vp.width / 2, vp.height / 2);
    await page.waitForTimeout(3500);
  } },
];
const browser = await chromium.launch({ channel: 'chrome' });
for (const s of sites) {
  for (const [kind, viewport, out] of [['desktop', { width: 1440, height: 900 }, [1280, 800]], ['phone', { width: 390, height: 844 }, [390, 844]]]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: kind === 'phone' ? 2 : 1, isMobile: kind === 'phone', hasTouch: kind === 'phone', colorScheme: 'dark', permissions: [] });
    const page = await ctx.newPage();
    try {
      await page.goto(s.url, { waitUntil: 'load', timeout: 120000 });
      await s.ready(page);
      await page.waitForTimeout(4000); // let intros, fonts and images settle
      if (await isWaking(page)) throw new Error('site still waking up');
      await s.redact?.(page);
      const png = await page.screenshot({ type: 'png' });
      const webp = await page.evaluate(async ({ b64, w, h }) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        return c.toDataURL('image/webp', 0.82);
      }, { b64: png.toString('base64'), w: out[0], h: out[1] });
      writeFileSync(join(root, `assets/projects/${s.id}-${kind}.webp`), Buffer.from(webp.split(',')[1], 'base64'));
      console.log('captured', s.id, kind, page.url());
    } catch (err) {
      console.log('failed', s.id, kind, err.message.split('\n')[0]);
    }
    await ctx.close();
  }
}
await browser.close();
