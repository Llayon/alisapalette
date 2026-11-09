import { test, expect } from './fixtures.js';

test('при тексте 200% название и кнопка в шапке не перекрываются', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#paletteList .pal-main').first()).toBeVisible();
  const before = await page.locator('.brand-name').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  expect(await page.locator('.brand-name').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(before * 2, 1);
  const title = await page.locator('.brand-name').boundingBox();
  const button = await page.locator('#topPickBtn').boundingBox();
  const overlap = title.x < button.x + button.width && title.x + title.width > button.x
    && title.y < button.y + button.height && title.y + title.height > button.y;
  expect(overlap).toBe(false);
  expect(title.x + title.width).toBeLessThanOrEqual(page.viewportSize().width);
  expect(button.x + button.width).toBeLessThanOrEqual(page.viewportSize().width);
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#topPickBtn').click();
  expect(await chooser).toBeTruthy();
});
