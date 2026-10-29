// Phase 8 gates: evidence graph interaction, equivalence with the list, filters.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const resume = JSON.parse(readFileSync(new URL('../../data/resume.json', import.meta.url)));
const label = (id) => [...resume.skills.languages, ...resume.skills.tools].find((s) => s.id === id).label;
const entity = (id) => { const e = [...resume.experience, ...resume.projects, ...resume.leadership].find((x) => x.id === id); return e.title ?? e.organization; };

test.describe('desktop board', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('hover previews, click pins, repeat or Escape clears, focus stays put', async ({ page }) => {
    await page.goto('/#skills');
    const python = page.getByRole('button', { name: 'Python', exact: true });
    const status = page.locator('.skills-status');
    await python.hover();
    await expect(page.locator('.skills-board-svg path.is-active')).toHaveCount(2);
    await expect(status).toHaveText(''); // nothing announced on hover
    await python.click();
    await expect(python).toHaveAttribute('aria-pressed', 'true');
    await expect(status).toHaveText('Python: Radicubs Robotics (FIRST), TideCast.');
    await expect(page.getByRole('button', { name: 'Clear selection' })).toBeVisible();
    // A transient preview of another item wins until the pointer leaves.
    await page.getByRole('button', { name: 'Vedam', exact: true }).hover();
    await expect(page.locator('.skills-board-svg path.is-active')).toHaveCount(2);
    await page.mouse.move(5, 5);
    await expect(python).toHaveAttribute('aria-pressed', 'true');
    await python.click();
    await expect(python).toHaveAttribute('aria-pressed', 'false');
    await python.focus();
    await page.keyboard.press('Enter');
    await expect(python).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(python).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.skills-board-svg path.is-active')).toHaveCount(0);
  });

  test('a skill without documented links says so without inventing any', async ({ page }) => {
    await page.goto('/#skills');
    await page.getByRole('button', { name: 'Git/GitHub', exact: true }).click();
    await expect(page.locator('.skills-status')).toHaveText('Git/GitHub: No documented project link for this skill.');
    await expect(page.locator('.skills-board-svg path.is-active')).toHaveCount(0);
  });

  test('every relation in the data is drawn, and only those', async ({ page }) => {
    await page.goto('/#skills');
    await page.waitForTimeout(800);
    await expect(page.locator('.skills-board-svg path')).toHaveCount(resume.skillRelations.length);
    for (const r of resume.skillRelations) {
      await page.getByRole('button', { name: label(r.skillId), exact: true }).click();
      await expect(page.locator('.skills-status')).toContainText(entity(r.entityId));
    }
  });

  test('labels keep full contrast while unrelated traces dim', async ({ page }) => {
    await page.goto('/#skills');
    await page.getByRole('button', { name: 'Java', exact: true }).click();
    await page.mouse.move(5, 5);
    await page.waitForTimeout(500); // let the opacity transition finish
    const dim = await page.locator('.skills-board-svg path.is-dim').first().evaluate((p) => +getComputedStyle(p).opacity);
    expect(dim).toBeCloseTo(0.25, 2);
    for (const b of await page.locator('.skills-board .smd, .skills-board .ic').all()) {
      expect(+(await b.evaluate((el) => getComputedStyle(el).opacity))).toBe(1);
    }
  });

  test('the SVG is 1 unit per CSS pixel, so the 240px/s dash speed holds at any size', async ({ page }) => {
    await page.goto('/#skills');
    await page.waitForTimeout(600);
    const [vbw, w] = await page.locator('.skills-board-svg').evaluate((s) => [s.viewBox.baseVal.width, s.getBoundingClientRect().width]);
    expect(Math.abs(vbw - w)).toBeLessThan(1);
  });
});

test.describe('narrow screens', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the filter shows the same relationships as the board', async ({ page }) => {
    await page.goto('/#skills');
    const select = page.getByLabel('Show links for');
    await expect(select).toBeVisible();
    await select.selectOption({ label: 'TideCast' });
    const shown = await page.locator('.skill:not(.is-filtered-out) .skill-name').allTextContents();
    const expected = resume.skillRelations.filter((r) => r.entityId === 'tidecast').map((r) => label(r.skillId));
    expect([...shown].sort()).toEqual([...expected].sort());
    await select.selectOption({ label: 'Git/GitHub' });
    await expect(page.locator('.skills-filter-status')).toHaveText('Git/GitHub: No documented project link for this skill.');
    await select.selectOption({ index: 0 });
    await expect(page.locator('.skill:not(.is-filtered-out)')).toHaveCount(15);
    await expect(page.locator('.cert-items li')).toHaveCount(3);
  });
});
