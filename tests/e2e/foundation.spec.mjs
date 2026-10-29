// Phase 1–2 gates: static content without JS, themes, navigation, focus, reflow.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const resume = JSON.parse(readFileSync(new URL('../../data/resume.json', import.meta.url)));
const bg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('every fact is present and readable', async ({ page }) => {
    await page.goto('/');
    const text = await page.locator('body').innerText();
    for (const e of resume.experience) for (const b of e.bullets) expect(text).toContain(b.text);
    for (const p of resume.projects) for (const b of p.bullets) expect(text).toContain(b.text);
    for (const l of resume.leadership) expect(text).toContain(l.organization);
    for (const c of resume.certifications) expect(text).toContain(c.label);
    await expect(page.locator('.beat-art').first()).toBeVisible();
    await expect(page.locator('.copy-email')).toBeHidden();
    await expect(page.locator('.footer-controls')).toBeHidden();
    expect(await page.locator('html').getAttribute('data-tier')).toBeNull();
  });
});

test('theme follows the OS until chosen, persists, and returns to System', async ({ page }) => {
  await page.goto('/');
  expect(await bg(page)).toBe('rgb(6, 18, 30)');
  await page.getByRole('radio', { name: 'Light' }).check();
  expect(await bg(page)).toBe('rgb(246, 239, 227)');
  await page.reload();
  expect(await bg(page)).toBe('rgb(246, 239, 227)');
  await expect(page.getByRole('radio', { name: 'Light' })).toBeChecked();
  await page.getByRole('radio', { name: 'System' }).first().check();
  expect(await bg(page)).toBe('rgb(6, 18, 30)');
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await bg(page)).toBe('rgb(246, 239, 227)');
});

test('blocked storage does not break theme or motion controls', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
  });
  await page.goto('/');
  await page.getByRole('radio', { name: 'Dark' }).check();
  await page.getByRole('radio', { name: 'Reduced' }).check();
  expect(await page.locator('html').getAttribute('data-theme')).toBe('dark');
  expect(errors).toEqual([]);
});

// Safari keeps links out of the Tab order unless the user opts in; its keyboard
// users press Option+Tab, which is what WebKit gets here.
const tabKey = (browserName) => (browserName === 'webkit' ? 'Alt+Tab' : 'Tab');

test('skip link is first and moves focus into main', async ({ page, browserName }) => {
  await page.goto('/');
  await page.keyboard.press(tabKey(browserName));
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  const focused = await page.evaluate(() => document.activeElement.closest('main') !== null || document.activeElement.id === 'main');
  expect(focused).toBe(true);
});

test('See my work goes straight to projects and focuses its heading', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'See my work' }).click();
  await expect(page).toHaveURL(/#projects$/);
  await expect(page.locator('#projects-title')).toBeFocused();
  await expect(page.locator('#projects-title')).toBeInViewport();
});

test('keyboard reaches every action and focus is never hidden by the header', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const seen = new Set();
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press(tabKey(browserName));
    const info = await page.evaluate(async () => {
      // Let any focus-driven smooth scroll settle before measuring.
      await new Promise((resolve) => {
        let last = -1, still = 0;
        const tick = () => { still = scrollY === last ? still + 1 : 0; last = scrollY; still > 4 ? resolve() : requestAnimationFrame(tick); };
        tick();
      });
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect();
      const header = document.getElementById('site-header');
      const fixed = header.contains(el) || el.closest('.chapters') || el.classList.contains('skip-link');
      return { key: (el.getAttribute('href') || '') + '|' + (el.textContent || '').trim().slice(0, 40), top: r.top, bottom: r.bottom, headerBottom: header.getBoundingClientRect().bottom, fixed: !!fixed };
    });
    if (!info) continue;
    seen.add(info.key);
    if (!info.fixed) expect(info.top, `obscured: ${info.key}`).toBeGreaterThanOrEqual(info.headerBottom - 1);
  }
  const keys = [...seen].join('\n');
  for (const p of resume.projects) {
    if (p.liveUrl) expect(keys).toContain(p.liveUrl);
    if (p.codeUrl) expect(keys).toContain(p.codeUrl);
  }
  expect(keys).toContain('mailto:');
  expect(keys).toContain('Copy email');
});

test('header turns to glass after scrolling past the threshold', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#site-header')).not.toHaveClass(/is-scrolled/);
  await page.mouse.wheel(0, 400);
  await expect(page.locator('#site-header')).toHaveClass(/is-scrolled/);
});

test('small screens: menu button discloses the links', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Menu' });
  await expect(button).toBeVisible();
  await expect(page.locator('#primary-links')).toBeHidden();
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('link', { name: 'Skills' }).first().click();
  await expect(page).toHaveURL(/#skills$/);
  await expect(button).toHaveAttribute('aria-expanded', 'false');
});

for (const width of [320, 390, 768, 859, 860, 1024, 1440]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    expect(await noHorizontalScroll(page)).toBe(true);
  });
}

test('320px at 200% text size still reflows', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await noHorizontalScroll(page)).toBe(true);
  await expect(page.locator('#hero-name')).toBeVisible();
});

test('pause motion is a toggle button', async ({ page }) => {
  await page.goto('/');
  const pause = page.getByRole('button', { name: 'Pause motion' });
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
});
