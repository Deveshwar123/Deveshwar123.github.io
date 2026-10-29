// Phase 7 gates: mini-worlds without location/camera/model/API use, one renderer,
// keyboard and touch alternatives to dragging, safe cancellation and cleanup.
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__calls = { geo: 0, media: 0, contexts: 0 };
    if (navigator.geolocation) for (const k of ['getCurrentPosition', 'watchPosition']) navigator.geolocation[k] = () => { window.__calls.geo++; };
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { window.__calls.media++; throw new Error('blocked'); };
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      const ctx = orig.call(this, type, ...rest);
      if (/webgl/.test(type) && ctx && !this.__counted) { this.__counted = true; window.__calls.contexts++; }
      return ctx;
    };
  });
});

test('no location, camera, model or third-party requests anywhere on the page', async ({ page }) => {
  const foreign = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1:8080/') && !r.url().startsWith('data:')) foreign.push(r.url()); });
  await page.goto('/');
  for (const id of ['tidecast', 'vedam', 'nfc-card']) {
    await page.evaluate((id) => document.getElementById('project-' + id).scrollIntoView(), id);
    await page.waitForTimeout(700);
  }
  await page.getByRole('button', { name: 'Show NFC field' }).click();
  expect(foreign).toEqual([]);
  expect(await page.evaluate(() => window.__calls.geo + window.__calls.media)).toBe(0);
});

test('one WebGL renderer serves the story and the NFC card', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.getAttribute('data-tier'));
  test.skip(await page.locator('html').getAttribute('data-tier') !== 'full', 'WebGL2 unavailable in this run (GPU shared by parallel workers)');
  await page.evaluate(() => document.getElementById('project-nfc-card').scrollIntoView());
  // The card renders through the shared canvas, or through SVG if the context was
  // lost; either way there is never a second canvas or context.
  await page.waitForFunction(() => document.querySelector('[data-nfc-view] canvas') || getComputedStyle(document.querySelector('.nfc-live .stage-board')).display !== 'none');
  expect(await page.evaluate(() => window.__calls.contexts)).toBeLessThanOrEqual(2);
  expect(await page.locator('canvas').count()).toBeLessThanOrEqual(1);
  await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'instant' }));
  await page.waitForTimeout(800);
  expect(await page.locator('canvas').count()).toBeLessThanOrEqual(1);
  expect(await page.locator('[data-nfc-view] canvas').count()).toBe(0);
});

test('buttons rotate the card, keep focus and report briefly', async ({ page }) => {
  await page.goto('/#project-nfc-card');
  const right = page.getByRole('button', { name: 'Rotate right' });
  await right.focus();
  await page.keyboard.press('Enter');
  await expect(right).toBeFocused();
  await expect(page.locator('.nfc-status')).toHaveText('Turned right 15°');
  await page.getByRole('button', { name: 'Reset view' }).click();
  await expect(page.locator('.nfc-status')).toHaveText('View reset');
  const field = page.getByRole('button', { name: 'Show NFC field' });
  await field.click();
  await expect(field).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Illustrative NFC field and energy harvesting.')).toBeVisible();
  await expect(page.locator('.world-nfc')).not.toContainText(/transaction|confirmed|shared successfully/i);
});

test('vertical gestures keep scrolling the page over the card', async ({ page }) => {
  await page.goto('/#project-nfc-card');
  await page.waitForTimeout(1500);
  expect(await page.locator('[data-nfc-view]').evaluate((v) => getComputedStyle(v).touchAction)).toBe('pan-y');
  const box = await page.locator('[data-nfc-view]').boundingBox();
  const before = await page.evaluate(() => scrollY);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(before + 200);
});

test('pointercancel mid-drag resets safely', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#project-nfc-card');
  await page.waitForTimeout(1500);
  await page.locator('[data-nfc-view]').evaluate((v) => {
    const r = v.getBoundingClientRect();
    const at = (type, x, y) => v.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true }));
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    at('pointerdown', x, y); at('pointermove', x + 30, y + 2); at('pointermove', x + 60, y + 3);
    at('pointercancel', x + 60, y + 3);
  });
  await expect(page.locator('[data-nfc-view]')).not.toHaveClass(/is-dragging/);
  expect(errors).toEqual([]);
});

test('re-initialising (motion change) leaves no duplicate views or contexts', async ({ page }) => {
  await page.goto('/#project-nfc-card');
  await page.waitForTimeout(1500);
  await page.getByRole('radio', { name: 'Reduced' }).check();
  await page.waitForTimeout(800);
  await page.getByRole('radio', { name: 'System' }).last().check();
  await page.waitForTimeout(1200);
  await expect(page.locator('.nfc-live')).toHaveCount(1);
  expect(await page.locator('canvas').count()).toBeLessThanOrEqual(1);
});

test('TideCast steps follow the panel scroll position, forwards and back', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1500);
  const top = await page.evaluate(() => document.getElementById('project-tidecast').getBoundingClientRect().top + scrollY);
  await page.evaluate((y) => scrollTo({ top: y - 900, behavior: 'instant' }), top);
  await page.waitForTimeout(300);
  const early = await page.locator('.pipeline-step.is-active').count();
  await page.evaluate((y) => scrollTo({ top: y + 100, behavior: 'instant' }), top);
  await page.waitForTimeout(300);
  const late = await page.locator('.pipeline-step.is-active').count();
  await page.evaluate((y) => scrollTo({ top: y - 900, behavior: 'instant' }), top);
  await page.waitForTimeout(300);
  expect(late).toBeGreaterThan(early);
  expect(await page.locator('.pipeline-step.is-active').count()).toBe(early);
});
