import { test, expect } from './fixtures.js';

async function ready(page) {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#paletteList .pal-main').first()).toBeVisible();
}

test('оттенки сочетаний копируются с клавиатуры', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    window.copiedColors = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async text => { window.copiedColors.push(text); }
    } });
  });
  const row = page.locator('#harmonyContainer .swrow').first();
  const hex = await row.getAttribute('data-hex');
  await row.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.copiedColors)).toEqual([hex]);
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.copiedColors)).toEqual([hex, hex]);
  await expect(row).toBeFocused();
});

test('Enter и Space сохраняют фокус, удаление переводит его к соседней карточке', async ({ page }) => {
  await ready(page);
  const card = page.locator('#paletteList .pal-card').nth(1);
  const id = await card.getAttribute('data-id');
  await card.locator('.pal-main').focus();
  await page.keyboard.press('Enter');
  const same = page.locator(`#paletteList .pal-card[data-id="${id}"]`);
  await expect(same.locator('.pal-main')).toBeFocused();
  await expect(same.locator('.pal-main')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space');
  await expect(same.locator('.pal-main')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(same.locator('[data-act="copy"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(same.locator('[data-act="del"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(same).toHaveCount(0);
  await expect(page.locator('#paletteList .pal-card').nth(1).locator('[data-act="del"]')).toBeFocused();
});

test('сообщения сохранения и неподдерживаемой отправки не меняют буфер', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    window.clipboardValue = 'keep this'; window.copyCalls = 0;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async text => { window.clipboardValue = text; window.copyCalls++; }
    } });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
  });
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 15000 });
  await Promise.all([page.waitForEvent('download'), page.locator('#savePngBtn').click()]);
  await page.locator('#shareStoryBtn').click();
  expect(await page.evaluate(() => ({ value: window.clipboardValue, calls: window.copyCalls })))
    .toEqual({ value: 'keep this', calls: 0 });
  await page.locator('#copyAppLinkBtn').click();
  await expect.poll(() => page.evaluate(() => window.copyCalls)).toBe(1);
  expect(await page.evaluate(() => window.clipboardValue)).toBe('https://llayon.github.io/alisapalette/');
});

test('успех копирования показывается после завершения, отказ сообщает об ошибке', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: () => new Promise(resolve => { window.finishCopy = resolve; })
    } });
  });
  await page.locator('#paletteList [data-act="copy"]').first().click();
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
  await page.evaluate(() => window.finishCopy());
  await expect(page.locator('#toast')).toHaveClass(/show/);
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => { throw new Error('denied'); };
    document.execCommand = () => false;
  });
  const button = page.locator('#paletteList [data-act="copy"]').first();
  await button.click();
  await expect(page.locator('#toastText')).toContainText('Не удалось скопировать');
  await expect(button).toBeFocused();
});
