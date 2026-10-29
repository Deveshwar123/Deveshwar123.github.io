// Phase 9 gates: native cursor kept, effects off for touch/keyboard/reduced
// motion, hit targets fixed, loops settle, Pause motion halts idle decoration.
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

test('the native cursor stays; the ring is decorative and pointer-inert', async ({ page }) => {
  await page.goto('/');
  await page.mouse.move(400, 400);
  await page.mouse.move(420, 410);
  const ring = page.locator('.cursor-ring');
  await expect(ring).toHaveCount(1);
  await expect(ring).toHaveAttribute('aria-hidden', 'true');
  expect(await ring.evaluate((r) => getComputedStyle(r).pointerEvents)).toBe('none');
  expect(await page.evaluate(() => getComputedStyle(document.body).cursor)).not.toBe('none');
});

test('magnetism moves only the label, never the hit target, and settles', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.cursor-ring', { state: 'attached' });
  const cta = page.getByRole('link', { name: 'See my work' });
  const before = await cta.boundingBox();
  await page.mouse.move(before.x + before.width + 40, before.y + before.height / 2);
  await page.waitForTimeout(600);
  const after = await cta.boundingBox();
  expect(after).toEqual(before);
  const shift = await cta.locator('.magnet-art').evaluate((m) => new DOMMatrix(getComputedStyle(m).transform).m41);
  expect(Math.abs(shift)).toBeGreaterThan(0.5);
  expect(Math.abs(shift)).toBeLessThanOrEqual(6.01);
  await page.mouse.move(20, 20);
  await page.waitForTimeout(1200);
  const rest = await cta.locator('.magnet-art').evaluate((m) => getComputedStyle(m).transform);
  expect(rest).toBe('none');
});

test('keyboard focus switches magnetism off', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.cursor-ring', { state: 'attached' });
  const cta = page.getByRole('link', { name: 'See my work' });
  const box = await cta.boundingBox();
  await page.mouse.move(box.x + box.width + 30, box.y + box.height / 2);
  await page.waitForTimeout(400);
  await cta.focus();
  await page.keyboard.press('Shift');
  await page.waitForTimeout(800);
  expect(await cta.locator('.magnet-art').evaluate((m) => getComputedStyle(m).transform)).toBe('none');
});

test('Pause motion removes the ring and halts ambient motion', async ({ page }) => {
  await page.goto('/');
  await page.mouse.move(300, 300);
  await expect(page.locator('.cursor-ring')).toHaveCount(1);
  await page.getByRole('button', { name: 'Pause motion' }).click();
  await expect(page.locator('.cursor-ring')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo({ top: Math.max(2400, 4 * innerHeight), behavior: 'instant' }));
  await page.waitForTimeout(600);
  const playing = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && /breathe|sweep|ping/.test(a.animationName || '')).length);
  expect(playing).toBe(0);
});

test.describe('touch devices', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('no ring and no magnetism on coarse pointers', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1200);
    await expect(page.locator('.cursor-ring')).toHaveCount(0);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('no ring, no magnetism', async ({ page }) => {
    await page.goto('/');
    await page.mouse.move(300, 300);
    await page.waitForTimeout(600);
    await expect(page.locator('.cursor-ring')).toHaveCount(0);
  });
});
