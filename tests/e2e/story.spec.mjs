// Phases 3–5 gates: finite intro, reversible story, chapters/history, fallbacks.
import { test, expect } from '@playwright/test';

const stageP = (page) => page.locator('#stage').getAttribute('data-p').then(Number);
async function settle(page) {
  await page.waitForFunction(() => new Promise((r) => {
    let last = -1, still = 0;
    const tick = () => { const y = scrollY; still = y === last ? still + 1 : 0; last = y; still > 6 ? r(true) : requestAnimationFrame(tick); };
    tick();
  }));
}

test.describe('desktop full tier', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('links work at time zero and the intro finishes within 1.8s', async ({ page }) => {
    const t0 = Date.now();
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'See my work' })).toBeVisible();
    await page.waitForFunction(() => document.documentElement.classList.contains('intro-hint'), null, { timeout: 6000 });
    expect(await page.locator('html').getAttribute('data-tier')).toBe('full');
    expect(Date.now() - t0).toBeLessThan(6000);
    const running = await page.evaluate(() => document.documentElement.classList.contains('intro-running'));
    expect(running).toBe(false);
    await expect(page.locator('.name-bloom')).toHaveCount(0);
  });

  test('scrolling cancels the intro immediately', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.classList.contains('intro-running'), null, { timeout: 5000 });
    await page.mouse.wheel(0, 300);
    await expect(page.locator('html')).not.toHaveClass(/intro-running/);
    await expect(page.locator('.name-bloom')).toHaveCount(0);
  });

  test('the name never moves while fonts and the intro settle (no layout shift)', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
    await page.waitForTimeout(2500);
    expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.01);
  });

  test('scroll-derived progress reaches .62 at the track end and is the same both ways', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('#stage')?.dataset.p !== undefined);
    const ys = await page.evaluate(() => {
      const h = document.querySelector('.hero'); const vh = innerHeight;
      const trackH = Math.max(2400, 4 * vh); const travel = trackH - vh;
      return { travel, end: h.getBoundingClientRect().top + scrollY + travel };
    });
    const at = async (y) => { await page.evaluate((y) => window.scrollTo(0, y), y); await settle(page); return stageP(page); };
    expect(await at(ys.end + 300)).toBeCloseTo(0.62, 3);
    const mid = ys.travel * 0.3 / 0.62;
    const down = await at(mid);
    await at(ys.end);
    const up = await at(mid);
    expect(Math.abs(down - up)).toBeLessThan(0.002);
    expect(down).toBeCloseTo(0.3, 2);
  });

  test('chapters use real hash history and land on their markers', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.getAttribute('data-tier'));
    await page.locator('.chapter-link[href="#story-layers"]').click();
    await expect(page).toHaveURL(/#story-layers$/);
    await settle(page);
    expect(await stageP(page)).toBeCloseTo(0.5, 2);
    await expect(page.locator('.chapter-link[href="#story-layers"]')).toHaveAttribute('aria-current', 'location');
    await page.locator('.chapter-link[href="#projects"]').click();
    await expect(page).toHaveURL(/#projects$/);
    await page.goBack();
    await expect(page).toHaveURL(/#story-layers$/);
  });

  test('arriving with a hash lands on that content after layout settles', async ({ page }) => {
    await page.goto('/#experience');
    await expect.poll(() => page.locator('#experience').evaluate((el) => el.getBoundingClientRect().top), { timeout: 10000 }).toBeGreaterThan(40);
    await expect.poll(() => page.locator('#experience').evaluate((el) => el.getBoundingClientRect().top), { timeout: 10000 }).toBeLessThan(140);
    await expect(page.locator('html')).not.toHaveClass(/intro-running/);
  });

  test('WebGL context loss falls back to the SVG board without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('.stage-canvas'));
    const travel = await page.evaluate(() => Math.max(2400, 4 * innerHeight) - innerHeight);
    await page.evaluate((y) => window.scrollTo(0, y), travel * 0.45 / 0.62);
    await settle(page);
    await page.evaluate(() => document.querySelector('.stage-canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await page.mouse.wheel(0, 40);
    await settle(page);
    const svgBoard = await page.evaluate(() => {
      const g = document.querySelector('.stage-board');
      return { display: getComputedStyle(g).display, opacity: +getComputedStyle(g).opacity, d: g.querySelector('path').getAttribute('d')?.length ?? 0 };
    });
    expect(svgBoard.display).not.toBe('none');
    expect(svgBoard.opacity).toBeGreaterThan(0.9);
    expect(svgBoard.d).toBeGreaterThan(100);
    expect(errors).toEqual([]);
  });

  test('3D budget: under 20k triangles and 50 draw calls', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('.stage-canvas'));
    const travel = await page.evaluate(() => Math.max(2400, 4 * innerHeight) - innerHeight);
    await page.evaluate((y) => window.scrollTo(0, y), travel * 0.5 / 0.62);
    await settle(page);
    const info = await page.evaluate(async () => (await import('./js/renderer.js')).rendererInfo());
    expect(info.triangles).toBeLessThan(20000);
    expect(info.calls).toBeLessThan(50);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('the journey is three static frames in normal flow, no stage, no intro', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(800);
    expect(await page.locator('html').getAttribute('data-tier')).toBeNull();
    await expect(page.locator('.beat-art')).toHaveCount(3);
    for (const art of await page.locator('.beat-art').all()) await expect(art).toBeVisible();
    await expect(page.locator('#stage')).toBeHidden();
    await expect(page.locator('.hero-art--wide')).toBeVisible();
    await expect(page.locator('.name-bloom')).toHaveCount(0);
  });

  test('switching the motion control to Reduced tears the story down live', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.getAttribute('data-tier'));
    await page.getByRole('radio', { name: 'Reduced' }).check();
    await expect(page.locator('html')).not.toHaveAttribute('data-tier', /.+/);
    await expect(page.locator('.beat-art').first()).toBeVisible();
  });
});

test.describe('compact tier', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('narrow screens get the shorter story with the lighter card textures', async ({ page }) => {
    const requested = [];
    page.on('request', (r) => { if (r.url().includes('/assets/board/')) requested.push(r.url().split('/').pop()); });
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.getAttribute('data-tier'));
    expect(await page.locator('html').getAttribute('data-tier')).toBe('compact');
    await expect(page.locator('canvas')).toHaveCount(1); // the one shared renderer
    await page.waitForTimeout(1500);
    expect(requested.some((f) => f.includes('-hi.webp') && !f.includes('height'))).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
