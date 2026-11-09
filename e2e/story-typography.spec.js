import { test, expect } from './fixtures.js';

test('длинные заголовки рисуются в границах холста во всех шаблонах', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#paletteList .pal-main').first()).toBeVisible();
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 20000 });
  for (const title of ['Моя невероятно длинная достопримечательность воскресного утра', 'W'.repeat(60), '   ']) {
    await page.locator('#storyTitleInput').fill(title);
    const measured = await page.evaluate(() => {
      const original = CanvasRenderingContext2D.prototype.fillText;
      const texts = [];
      CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...rest) {
        const size = Number(/([\d.]+)px/.exec(this.font)?.[1] || 0);
        if (size >= 54) {
          const m = this.measureText(text);
          texts.push({ text, left: x - m.actualBoundingBoxLeft, right: x + m.actualBoundingBoxRight });
        }
        return original.call(this, text, x, y, ...rest);
      };
      try {
        for (const template of ['editorial', 'polaroid', 'magazine', 'aroma']) window.__storyShot(template);
        return texts;
      } finally { CanvasRenderingContext2D.prototype.fillText = original; }
    });
    if (title.trim()) expect(measured.length).toBeGreaterThan(0);
    for (const text of measured) {
      expect(text.left, text.text).toBeGreaterThanOrEqual(0);
      expect(text.right, text.text).toBeLessThanOrEqual(1080);
    }
  }
});
