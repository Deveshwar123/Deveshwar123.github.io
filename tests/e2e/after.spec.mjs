// Phase 6 gates: count-ups, timeline trace, once-only reveals that never hide facts.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const resume = JSON.parse(readFileSync(new URL('../../data/resume.json', import.meta.url)));
test.use({ viewport: { width: 1440, height: 900 } });
const jump = (page, y) => page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
const topOf = (page, sel) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + scrollY, sel);

test('counters animate a decorative overlay; assistive text is the final value throughout', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.classList.contains('has-reveals'));
  const accessible = () => page.evaluate(() => [...document.querySelectorAll('.stat-value')].map((e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('')));
  expect(await accessible()).toEqual(resume.snapshot.map((s) => s.value));
  await jump(page, (await topOf(page, '#snapshot')) - 100);
  await page.waitForTimeout(250);
  const overlays = await page.locator('.stat-count').count();
  expect(overlays).toBeGreaterThan(0);
  for (const o of await page.locator('.stat-count').all()) await expect(o).toHaveAttribute('aria-hidden', 'true');
  expect(await accessible()).toEqual(resume.snapshot.map((s) => s.value));
  await expect(page.locator('.stat-count')).toHaveCount(0, { timeout: 3000 });
  const snapshot = page.getByRole('list').filter({ has: page.locator('.stat') });
  await expect(snapshot).toContainText('120+');
});

test('the timeline trace follows scroll both ways and never hides revealed text', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('.timeline-trace'));
  const exp = await topOf(page, '#experience');
  await jump(page, exp + 900);
  await expect(page.locator('.role').last()).toHaveClass(/is-reached/);
  const offsetDown = await page.locator('.timeline-trace path:not(.trace-base)').evaluate((p) => parseFloat(p.style.strokeDashoffset));
  await jump(page, exp - 600);
  await expect(page.locator('.role').first()).not.toHaveClass(/is-reached/);
  const offsetUp = await page.locator('.timeline-trace path:not(.trace-base)').evaluate((p) => parseFloat(p.style.strokeDashoffset));
  expect(offsetUp).toBeGreaterThan(offsetDown);
  // Text revealed on the way down stays visible after the trace retracts.
  const opacity = await page.locator('#role-radicubs .bullets li').first().evaluate((li) => getComputedStyle(li).opacity);
  expect(+opacity).toBe(1);
});

test('jumping to a section reveals it and everything above it', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.classList.contains('has-reveals'));
  await page.getByRole('link', { name: 'Contact' }).first().click();
  await page.waitForTimeout(1500);
  const hidden = await page.evaluate(() => [...document.querySelectorAll('[data-reveal]')].filter((c) => !c.classList.contains('is-revealed')).map((c) => c.className));
  expect(hidden.filter((c) => !/bullets/.test(c))).toEqual([]);
  await expect(page.locator('#contact-title')).toHaveText('Let’s build something.');
});

test('keyboard focus inside a hidden group reveals it immediately', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.classList.contains('has-reveals'));
  await page.locator('#project-vedam .project-actions a').focus();
  await expect(page.locator('#project-vedam .bullets')).toHaveClass(/is-revealed/);
});

test('line splitting keeps one copy of each heading and restores it afterwards', async ({ page }) => {
  await page.goto('/#skills');
  await expect(page.getByRole('heading', { name: 'Skills', level: 2 })).toHaveCount(1);
  await expect(page.locator('#skills-title .reveal-line')).toHaveCount(0, { timeout: 12000 });
  expect(await page.locator('#skills-title').textContent()).toBe('Skills');
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('no reveals, no counters; certifications and Beyond are all there', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1200);
    await expect(page.locator('html')).not.toHaveClass(/has-reveals/);
    await expect(page.locator('.stat-count')).toHaveCount(0);
    for (const c of resume.certifications) await expect(page.getByText(c.label, { exact: true })).toBeVisible();
    for (const i of resume.interests) await expect(page.locator('.interest-label', { hasText: i.label })).toBeVisible();
  });
});
