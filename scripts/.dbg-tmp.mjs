import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
await page.goto('http://127.0.0.1:8080/#skills');
for (const t of [1000, 2000, 4000]) {
  await page.waitForTimeout(t === 1000 ? 1000 : t / 2);
  console.log(t, await page.evaluate(() => { const h = document.getElementById('skills-title'); const r = h.getBoundingClientRect(); return `scrollY=${Math.round(scrollY)} top=${Math.round(r.top)} cls=${h.className} revealed=${h.classList.contains('is-revealed')} split=${!!h.dataset.split} has=${document.documentElement.className}`; }));
}
await browser.close();
