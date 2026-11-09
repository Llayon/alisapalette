import { test, expect } from './fixtures.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

async function open(page) {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#paletteList .pal-main').first()).toBeVisible();
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 15000 });
  await page.locator('#storyPreview').scrollIntoViewIfNeeded();
}
const preview = async page => createHash('sha256').update(await page.locator('#storyPreview').evaluate(c => c.toDataURL())).digest('hex');
async function png(page) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#savePngBtn').click()]);
  return createHash('sha256').update(readFileSync(await download.path())).digest('hex');
}
async function move(page) {
  const canvas = page.locator('#storyPreview');
  const box = await canvas.boundingBox();
  await canvas.dispatchEvent('pointerdown', { pointerId: 41, button: 0, clientX: box.x + 50, clientY: box.y + 50 });
  await canvas.dispatchEvent('pointermove', { pointerId: 41, clientX: box.x + 50, clientY: box.y + 150 });
}

test('предпросмотр меняется до отпускания, отмена возвращает исходный PNG', async ({ page }) => {
  await open(page);
  const original = await preview(page), originalPng = await png(page);
  await page.locator('#storyPreview').scrollIntoViewIfNeeded();
  await move(page);
  await expect.poll(() => preview(page)).not.toBe(original);
  await expect(page.locator('#shareStoryBtn')).toBeDisabled();
  await page.locator('#storyPreview').dispatchEvent('pointerup', { pointerId: 99 });
  await expect(page.locator('#shareStoryBtn')).toBeDisabled();
  await page.locator('#storyPreview').dispatchEvent('pointercancel', { pointerId: 41 });
  await expect.poll(() => preview(page)).toBe(original);
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 15000 });
  expect(await png(page)).toBe(originalPng);
});

test('новое кадрирование сохраняется после отпускания, потеря захвата отменяет черновик', async ({ page }) => {
  await open(page);
  const original = await preview(page), originalPng = await png(page);
  await page.locator('#storyPreview').scrollIntoViewIfNeeded();
  await move(page);
  await expect.poll(() => preview(page)).not.toBe(original);
  await page.locator('#storyPreview').dispatchEvent('pointerup', { pointerId: 41 });
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 15000 });
  const committed = await preview(page), committedPng = await png(page);
  expect(committedPng).not.toBe(originalPng);
  await page.locator('#storyPreview').scrollIntoViewIfNeeded();
  await move(page);
  await page.locator('#storyPreview').dispatchEvent('lostpointercapture', { pointerId: 41 });
  await expect.poll(() => preview(page)).toBe(committed);
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 15000 });
  expect(await png(page)).toBe(committedPng);
});
