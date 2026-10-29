// Phase 10 gates: automated accessibility scan, CSP compliance, subdirectory
// hosting. Automated checks cannot certify WCAG AA; manual results live in
// reports/verification.md.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'node:child_process';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const scan = (page) => new AxeBuilder({ page }).withTags(TAGS).analyze();
const summarize = (r) => r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);

for (const scheme of ['dark', 'light']) {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    test(`axe: no WCAG 2.2 AA violations (${scheme}, ${name})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize(viewport);
      await page.goto('/');
      await page.waitForFunction(() => document.documentElement.classList.contains('is-enhanced'));
      await page.waitForTimeout(2200);
      // Reveal everything so axe sees final colours, not mid-transition ones.
      await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((c) => c.classList.add('is-revealed')));
      await page.waitForTimeout(700);
      expect(summarize(await scan(page))).toEqual([]);
    });
  }
}

test.describe('static tier', () => {
  test.use({ reducedMotion: 'reduce' });
  test('axe: no violations in the reduced-motion page', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1200);
    expect(summarize(await scan(page))).toEqual([]);
  });
});

test('axe: no violations with the skills board pinned and the NFC field on', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#skills');
  await page.waitForTimeout(2000);
  await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((c) => c.classList.add('is-revealed')));
  await page.getByRole('button', { name: 'TideCast', exact: true }).click();
  await page.getByRole('button', { name: 'Show NFC field' }).click();
  await page.waitForTimeout(700);
  expect(summarize(await scan(page))).toEqual([]);
});

test('no Content Security Policy violations while the page is exercised', async ({ page }) => {
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForTimeout(2500);
  for (const id of ['journey', 'experience', 'projects', 'skills', 'contact']) {
    await page.evaluate((id) => document.getElementById(id).scrollIntoView(), id);
    await page.waitForTimeout(500);
  }
  await page.getByRole('button', { name: 'Python', exact: true }).click();
  await page.getByRole('radio', { name: 'Light' }).check();
  expect(await page.evaluate(() => window.__csp)).toEqual([]);
  expect(errors).toEqual([]);
});

test.describe('subdirectory hosting', () => {
  let server;
  test.beforeAll(async () => {
    server = spawn('node', ['scripts/serve.mjs', '8091', '--base', '/portfolio/'], { stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 500));
  });
  test.afterAll(() => server?.kill());

  test('every resource loads under /portfolio/ (relative paths only)', async ({ page }) => {
    const failed = [];
    page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    page.on('requestfailed', (r) => failed.push(`failed ${r.url()}`));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:8091/portfolio/');
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.getElementById('projects').scrollIntoView());
    await page.waitForTimeout(1200);
    expect(failed).toEqual([]);
    expect(await page.locator('html').getAttribute('data-tier')).not.toBeNull();
  });
});
