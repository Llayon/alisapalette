import { test, expect } from './fixtures.js';

const saved = page => expect(page.locator('#projectSaveStatus')).toHaveText('Сохранено на устройстве', { timeout: 15000 });

for (const failure of ['getter', 'open']) {
  test(`photo and file backup remain usable when IndexedDB ${failure} is denied`, async ({ page }) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(mode => {
      const denied = () => { throw new DOMException('Denied', 'SecurityError'); };
      Object.defineProperty(window, 'indexedDB', mode === 'getter'
        ? { configurable: true, get: denied } : { configurable: true, value: { open: denied } });
    }, failure);
    await page.goto('/');
    await expect(page.locator('#paletteList .pal-main').first()).toBeVisible();
    await expect(page.locator('#projectSaveStatus')).toContainText('Не удалось сохранить');
    const [file] = await Promise.all([page.waitForEvent('download'), page.locator('#downloadCurrentProject').click()]);
    expect(file.suggestedFilename()).toMatch(/\.chromastyle\.json$/);
    expect(errors).toEqual([]);
  });
}

test('legacy studio preferences migrate into a recoverable project', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('chromastyle.story.v1')) localStorage.setItem('chromastyle.story.v1', JSON.stringify({
      template: 'magazine', count: 4, showNames: false, showHex: true, showPct: true, fit: 'contain'
    }));
  });
  await page.goto('/'); await saved(page);
  for (let i = 0; i < 2; i++) {
    await page.locator('#openStoriesModalBtn').click();
    await expect(page.locator('[data-story-template="magazine"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-story-count="4"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-story-fit="contain"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#storyNames')).not.toBeChecked();
    await expect(page.locator('#storyPct')).toBeChecked();
    await page.keyboard.press('Escape'); await saved(page);
    if (!i) { await page.reload(); await saved(page); }
  }
});

test('malformed legacy color count is ignored without breaking autosave', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('chromastyle.story.v1', JSON.stringify({ count: '4', template: 'aroma' })));
  await page.goto('/'); await saved(page);
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('[data-story-count="5"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-story-template="aroma"]')).toHaveAttribute('aria-pressed', 'true');
});

test('failed save preserves the current photo until changes are explicitly discarded', async ({ page }) => {
  await page.goto('/'); await saved(page);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'session') throw new DOMException('Full', 'QuotaExceededError');
      return put.apply(this, args);
    };
  });
  await page.locator('#refineBox').evaluate(el => { el.open = true; });
  await page.locator('#addCustomPinBtn').click();
  await expect(page.locator('#projectSaveStatus')).toContainText('Не удалось сохранить');
  const original = await page.evaluate(() => ({ palette: window.__chromastyle.palette,
    image: document.getElementById('mainCanvas').toDataURL() }));
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('[data-preset="flowers"]').click();
  expect(await page.evaluate(() => ({ palette: window.__chromastyle.palette,
    image: document.getElementById('mainCanvas').toDataURL() }))).toEqual(original);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-preset="flowers"]').click();
  await expect.poll(() => page.locator('#mainCanvas').evaluate(c => c.toDataURL())).not.toBe(original.image);
});
