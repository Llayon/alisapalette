import { test, expect } from './fixtures.js';
import { readFileSync } from 'node:fs';

async function downloadedPng(page) {
  const [file] = await Promise.all([page.waitForEvent('download'), page.locator('#savePngBtn').click()]);
  return readFileSync(await file.path());
}

async function saved(page) {
  await expect(page.locator('#projectSaveStatus')).toHaveText('Сохранено на устройстве', { timeout: 15000 });
}
async function addPin(page) {
  await page.locator('#refineBox').evaluate(el => { el.open = true; });
  await page.locator('#addCustomPinBtn').click();
}

test('edited palette, image, controls and story survive reload without reclustering', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#paletteList .pal-main').first()).toBeVisible();
  await addPin(page);
  await page.locator('#moreSettings').evaluate(el => { el.open = true; });
  await page.locator('#sortSelect').selectOption('luminance');
  await page.locator('[data-format="rgb"]').click();
  await page.locator('#openStoriesModalBtn').click();
  await page.locator('#storyTitleInput').fill('Сохранённый день');
  await page.locator('[data-story-template="polaroid"]').click();
  await page.locator('#storyPreview').focus();
  await page.keyboard.press('ArrowRight');
  await saved(page);
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 15000 });
  const storyImage = await page.locator('#storyPreview').evaluate(c => c.toDataURL());
  const storyPng = await downloadedPng(page);
  await saved(page);
  const before = await page.evaluate(() => ({
    palette: window.__chromastyle.palette, selected: window.__chromastyle.selectedColorId,
    image: document.getElementById('mainCanvas').toDataURL()
  }));
  await page.reload();
  await saved(page);
  expect(await page.evaluate(() => window.__chromastyle.palette)).toEqual(before.palette);
  expect(await page.evaluate(() => window.__chromastyle.selectedColorId)).toBe(before.selected);
  expect(await page.locator('#mainCanvas').evaluate(c => c.toDataURL())).toBe(before.image);
  await expect(page.locator('#sortSelect')).toHaveValue('luminance');
  await expect(page.locator('[data-format="rgb"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('#storyTitleInput')).toHaveValue('Сохранённый день');
  await expect(page.locator('[data-story-template="polaroid"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 15000 });
  expect(await page.locator('#storyPreview').evaluate(c => c.toDataURL())).toBe(storyImage);
  expect((await downloadedPng(page)).equals(storyPng)).toBe(true);
  await page.keyboard.press('Escape');
  await addPin(page);
  const ids = await page.evaluate(() => window.__chromastyle.palette.map(c => c.id));
  expect(new Set(ids).size).toBe(ids.length);
});

test('new photo wins pending saves and restores the matching image', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#paletteList .pal-main').first()).toBeVisible();
  await addPin(page);
  await page.locator('[data-preset="flowers"]').click();
  await expect(page.locator('#photoBadge')).toHaveText('Пример: пионы');
  const { image, label } = await page.evaluate(() => ({
    image: document.getElementById('mainCanvas').toDataURL(),
    label: document.getElementById('photoBadge').textContent
  }));
  await saved(page);
  await page.reload();
  await saved(page);
  await expect(page.locator('#photoBadge')).toHaveText(label);
  expect(await page.locator('#mainCanvas').evaluate(c => c.toDataURL())).toBe(image);
});

test('failed autosave reports failure, preserves previous revision and can be retried', async ({ page }) => {
  await page.goto('/');
  await saved(page);
  const original = await page.evaluate(() => window.__chromastyle.palette.length);
  await page.evaluate(() => {
    window.originalProjectPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'session') throw new DOMException('Full', 'QuotaExceededError');
      return window.originalProjectPut.apply(this, args);
    };
  });
  await addPin(page);
  await expect(page.locator('#projectSaveStatus')).toContainText('Не удалось сохранить');
  expect(await page.evaluate(() => window.__chromastyle.palette.length)).toBe(original + 1);
  await page.evaluate(() => { IDBObjectStore.prototype.put = window.originalProjectPut; });
  await page.locator('#retryProjectSave').click();
  await saved(page);
  await page.reload();
  await saved(page);
  expect(await page.evaluate(() => window.__chromastyle.palette.length)).toBe(original + 1);
});
