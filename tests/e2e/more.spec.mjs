// "More on GitHub": every card shows, its picture loads, its links go to real
// https destinations, nothing scrolls sideways, and axe passes in both themes.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

const { items } = JSON.parse(readFileSync(new URL('../../data/github-projects.json', import.meta.url), 'utf8'));
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function open(page) {
  await page.goto('/#more-on-github');
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((c) => c.classList.add('is-revealed')));
  await page.waitForTimeout(700);
}

for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  test(`every card shows with its picture and real links (${name})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    const block = page.locator('#more-on-github');
    await expect(block.getByRole('heading', { name: 'More on GitHub' })).toBeVisible();
    for (const p of items) {
      const card = page.locator(`#repo-${p.id}`);
      await card.scrollIntoViewIfNeeded();
      await expect(card.getByRole('heading', { name: p.title })).toBeVisible();
      await expect(card.getByRole('link', { name: `${p.title} Source code` })).toHaveAttribute('href', p.repo);
      if (p.liveUrl) await expect(card.getByRole('link', { name: `${p.title} Live site` })).toHaveAttribute('href', p.liveUrl);
      if (p.picture.kind === 'shot') {
        const img = card.locator('.repo-shot');
        await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth)).toBeGreaterThan(0);
      } else {
        await expect(card.locator('.code-line')).toHaveCount(p.picture.lines.length);
      }
    }
    const hrefs = await block.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    for (const h of hrefs) expect(h).toMatch(/^https:\/\//);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
}

for (const scheme of ['dark', 'light']) {
  test(`axe: no violations in More on GitHub (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    const r = await new AxeBuilder({ page }).include('#more-on-github').withTags(TAGS).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
}
