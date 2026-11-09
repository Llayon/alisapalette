import { test, expect } from './fixtures.js';
import { rgbToOklab } from '../src/color-science.js';

test('отмена перемещения восстанавливает цвет, центр кластера и доли', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.color-pin').first()).toBeVisible();
  const snapshot = () => page.evaluate(() => JSON.stringify(window.__chromastyle.palette));
  const before = await snapshot();
  const pin = page.locator('.color-pin').first();
  const box = await page.locator('#mainCanvas').boundingBox();
  await pin.dispatchEvent('pointerdown', { pointerId: 1, clientX: box.x, clientY: box.y });
  await pin.dispatchEvent('pointermove', { pointerId: 1, clientX: box.x + box.width * 0.5, clientY: box.y + box.height * 0.8 });
  expect(await snapshot()).not.toBe(before);
  await pin.dispatchEvent('pointercancel', { pointerId: 1 });
  expect(await snapshot()).toBe(before);
});

test('ручные точки сохраняют сортировку, выделение и допустимый HSL', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#paletteList .pal-main').first()).toBeVisible();
  await page.locator('#moreSettings > summary').click();
  await page.selectOption('#sortSelect', 'luminance');
  await page.locator('#refineBox > summary').click();
  const before = await page.locator('.color-pin').count();
  await page.locator('#addCustomPinBtn').click();
  await expect(page.locator('.color-pin')).toHaveCount(before + 1);
  await page.selectOption('#sortSelect', 'dominance');
  await page.selectOption('#sortSelect', 'luminance');
  const snapshot = () => page.evaluate(() => {
    const state = window.__chromastyle;
    return { colors: state.palette.map(({ r, g, b }) => ({ r, g, b })), selected: state.selectedColorId,
      ids: state.palette.map(c => c.id), sum: state.palette.reduce((sum, c) => sum + c.percentage, 0) };
  });
  const check = async () => {
    const state = await snapshot();
    const values = state.colors.map(c => rgbToOklab(c).L);
    expect(values).toEqual([...values].sort((a, b) => b - a));
    expect(state.sum).toBeCloseTo(100, 1);
    expect(state.ids).toContain(state.selected);
  };
  await check();
  const pin = page.locator('.color-pin').first();
  const box = await pin.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20, { steps: 3 });
  await page.mouse.up();
  await check();
  await page.locator('[data-format="hsl"]').click();
  expect(await page.locator('#paletteList .mono').evaluateAll(elements =>
    elements.every(element => CSS.supports('color', element.textContent)))).toBe(true);
  await page.locator('#paletteList [data-act="del"]').first().click();
  await check();
  expect(errors).toEqual([]);
});
