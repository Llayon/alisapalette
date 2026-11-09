import { test, expect } from './fixtures.js';

test('изменение цвета точки не перезапускает анимацию появления карточек', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.color-pin').first()).toBeVisible();
  const pin = page.locator('.color-pin').first();
  const box = await page.locator('#mainCanvas').boundingBox();
  const before = await page.evaluate(() => JSON.stringify(window.__chromastyle.palette.map(({r,g,b}) => [r,g,b])));
  await pin.dispatchEvent('pointerdown', { pointerId: 2, button: 0 });
  await pin.dispatchEvent('pointermove', { pointerId: 2, clientX: box.x + box.width * 0.74, clientY: box.y + box.height * 0.54 });
  expect(await page.evaluate(() => JSON.stringify(window.__chromastyle.palette.map(({r,g,b}) => [r,g,b])))).not.toBe(before);
  await expect(page.locator('#paletteList .pal-card.anim')).toHaveCount(0);
  await pin.dispatchEvent('pointerup', { pointerId: 2 });
});

test('погода не отменяет ожидающий пересчёт палитры', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#paletteList .pal-main').first()).toBeVisible();
  await page.evaluate(() => {
    window.previousPaletteIds = window.__chromastyle.palette.map(color => color.id).join();
    const count = document.querySelector('#colorCountSlider');
    count.value = '3';
    count.dispatchEvent(new Event('input', { bubbles: true }));
    const weather = document.querySelector('#weatherTempSlider');
    weather.value = '30';
    weather.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect.poll(() => page.evaluate(() => window.__chromastyle.palette.map(color => color.id).join() !== window.previousPaletteIds)).toBe(true);
  await expect(page.locator('#weatherTempLabel')).toHaveText('+30°C');
  await expect.poll(() => page.locator('#weatherAdviceText').textContent()).toContain('+30°C');
  expect(await page.evaluate(() => window.__chromastyle.colorCount)).toBe(3);
});

test('выбор цвета сохраняет карточки, точки и рекомендации', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#paletteList .pal-main').first()).toBeVisible();
  const result = await page.evaluate(() => {
    const selectors = ['#paletteList .pal-main', '.color-pin', '#proportionBar > *', '#olfactoryPyramidGrid > *', '#matchedProductsGrid > *'];
    const elements = selectors.map(selector => document.querySelector(selector));
    const second = document.querySelectorAll('#paletteList .pal-main')[1];
    second.focus();
    const id = second.closest('.pal-card').dataset.id;
    second.click();
    return {
      retained: elements.map((element, i) => !!element && document.querySelector(selectors[i]) === element),
      focused: document.activeElement === second,
      selected: second.getAttribute('aria-pressed') === 'true' && window.__chromastyle.selectedColorId === id,
      selectionCount: document.querySelectorAll('#paletteList .pal-main[aria-pressed="true"]').length,
      hex: window.__chromastyle.palette.find(color => color.id === id)
    };
  });
  expect(result.retained).toEqual([true, true, true, true, true]);
  expect(result.focused).toBe(true);
  expect(result.selected).toBe(true);
  expect(result.selectionCount).toBe(1);
  const { r, g, b } = result.hex;
  const hex = '#' + [r, g, b].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
  await expect(page.locator('#harmonyContainer')).toContainText(hex);
});
