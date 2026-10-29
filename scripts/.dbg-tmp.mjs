import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
await page.goto('http://127.0.0.1:8080/');
await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
await page.waitForTimeout(300);
console.log(await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.right > innerWidth + 1 && r.width > 0 && getComputedStyle(el).position !== 'fixed') out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} right=${Math.round(r.right)} w=${Math.round(r.width)} text=${(el.textContent||'').trim().slice(0,30)}`);
  }
  return [document.documentElement.scrollWidth, innerWidth, ...out.slice(0, 15)].join('\n');
}));
await browser.close();
