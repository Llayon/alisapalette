import { test, expect } from './fixtures.js';
test.use({ storyDiagnostics: false });
import { readFileSync } from 'node:fs';

test('фото, палитра и PNG работают в браузере', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#paletteList .pal-main').first()).toBeVisible();
  const photo = await page.locator('#mainCanvas').evaluate(canvas => canvas.toDataURL());
  await page.locator('#fileInput').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(photo.split(',')[1], 'base64') });
  await expect(page.locator('#photoBadge')).toHaveText('photo.png');
  await expect(page.locator('#paletteList .pal-main').first()).toBeVisible();
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 20000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#savePngBtn').click()]);
  const data = readFileSync(await download.path());
  expect([...data.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect([data.readUInt32BE(16), data.readUInt32BE(20)]).toEqual([1080, 1920]);
  await page.keyboard.press('Escape');
  await expect(page.locator('#exportModal')).toBeHidden();
  await expect(page.locator('#openStoriesModalBtn')).toBeFocused();
  expect(errors).toEqual([]);
});
