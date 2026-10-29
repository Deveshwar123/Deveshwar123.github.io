import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
await page.addInitScript(() => {
  window.__shifts = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), src: e.sources.map(s => (s.node?.nodeName || '?') + '.' + (s.node?.className?.baseVal ?? s.node?.className ?? '') + ' ' + JSON.stringify([s.previousRect.y, s.currentRect.y, s.previousRect.height, s.currentRect.height])) }); }).observe({ type: 'layout-shift', buffered: true });
});
await page.goto('http://127.0.0.1:8080/');
await page.waitForTimeout(2500);
console.log(JSON.stringify(await page.evaluate(() => window.__shifts), null, 1));
await browser.close();
