import { test, expect } from './fixtures.js';
import { readFileSync } from 'node:fs';

async function ready(page) {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#paletteList .pal-main').first()).toBeVisible();
}

test('при отказе большого canvas сохраняется PNG 720×1280', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
      if (this.width === 1080 && this.height === 1920) { queueMicrotask(() => callback(null)); return; }
      return original.call(this, callback, ...args);
    };
  });
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('#storyStatus.ready')).toContainText('720×1280', { timeout: 15000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#savePngBtn').click()]);
  const buffer = readFileSync(await download.path());
  expect([buffer.readUInt32BE(16), buffer.readUInt32BE(20)]).toEqual([720, 1280]);
  expect(download.suggestedFilename()).toContain('720x1280');
});

test('отмена системной отправки не скачивает PNG и сохраняет готовую открытку', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    window.shareCalls = 0;
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {
      window.shareCalls++; throw new DOMException('Cancelled', 'AbortError');
    } });
  });
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 15000 });
  const downloads = [];
  page.on('download', file => downloads.push(file));
  await page.locator('#shareStoryBtn').click();
  expect(await page.evaluate(() => window.shareCalls)).toBe(1);
  expect(downloads).toHaveLength(0);
  await expect(page.locator('#storyStatus.ready')).toBeVisible();
  await expect(page.locator('#shareStoryBtn')).toBeEnabled();
});
