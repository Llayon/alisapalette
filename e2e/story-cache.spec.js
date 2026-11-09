import { test, expect } from './fixtures.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

async function open(page) {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#paletteList .pal-main').first()).toBeVisible();
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 15000 });
}
async function png(page) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#savePngBtn').click()]);
  return createHash('sha256').update(readFileSync(await download.path())).digest('hex');
}

test('ошибка устаревшего сохранения не заменяет готовность новой открытки', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    let first = true, failFallback = false;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
      if (first) {
        first = false;
        window.failOldExport = () => { failFallback = true; callback(null); };
        return;
      }
      if (failFallback) {
        HTMLCanvasElement.prototype.toBlob = original;
        queueMicrotask(() => {
          callback(null);
          setTimeout(() => { window.oldExportFinished = true; }, 0);
        });
        return;
      }
      return original.call(this, callback, ...args);
    };
  });
  await page.locator('#storyTitleInput').fill('Old export');
  await page.locator('#savePngBtn').click();
  await expect.poll(() => page.evaluate(() => typeof window.failOldExport)).toBe('function');
  await page.locator('#storyTitleInput').fill('Latest export');
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 15000 });
  const latestStatus = await page.locator('#storyStatus').textContent();
  await page.evaluate(() => window.failOldExport());
  await expect.poll(() => page.evaluate(() => window.oldExportFinished)).toBe(true);
  await expect(page.locator('#storyStatus.ready')).toHaveText(latestStatus);
});

test('изменение настроек во время сохранения отбрасывает устаревший PNG', async ({ page }) => {
  await open(page);
  const downloads = [];
  page.on('download', file => downloads.push(file));
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
      HTMLCanvasElement.prototype.toBlob = original;
      original.call(this, blob => { window.releaseOldPng = () => callback(blob); }, ...args);
    };
  });
  await page.locator('#storyTitleInput').fill('First version');
  await page.locator('#savePngBtn').click();
  await expect.poll(() => page.evaluate(() => typeof window.releaseOldPng)).toBe('function');
  await page.locator('#storyTitleInput').fill('Latest version');
  await page.evaluate(() => window.releaseOldPng());
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 15000 });
  expect(downloads).toHaveLength(0);
  await png(page);
  expect(downloads).toHaveLength(1);
});

test('вставка нового фото обновляет открытую студию, код палитры и скачанный PNG', async ({ page }) => {
  await open(page);
  const original = await png(page);
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#345678'; ctx.fillRect(0, 0, 100, 100);
    const blob = await new Promise(resolve => canvas.toBlob(resolve));
    const clipboardData = new DataTransfer();
    clipboardData.items.add(new File([blob], 'replacement.png', { type: 'image/png' }));
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData }));
  });
  await expect(page.locator('#photoBadge')).toHaveText('replacement.png');
  await expect(page.locator('#exportCodeArea')).toHaveValue(/#345678/);
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 15000 });
  expect(await png(page)).not.toBe(original);
});
