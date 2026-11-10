import { test, expect } from './fixtures.js';
import AxeBuilder from '@axe-core/playwright';

const saved = page => expect(page.locator('#projectSaveStatus')).toHaveText('Сохранено на устройстве', { timeout: 15000 });
const cards = page => page.locator('#projectLibraryGrid .project-card');
async function submitName(page, name) {
  await page.locator('#projectNameInput').fill(name);
  await page.locator('#projectEditorConfirm').click();
  await expect(page.locator('#projectEditor')).not.toBeVisible();
}
async function saveNamed(page, name) {
  await page.locator('#saveProjectToLibrary').click();
  await submitName(page, name);
  await expect(page.locator('#projectLibrary')).toBeVisible();
  await expect(cards(page).filter({ hasText: name })).toBeVisible();
}

test('named library supports empty state, preview, rename, duplicate, open and delete', async ({ page }) => {
  await page.goto('/'); await saved(page);
  await page.locator('#openProjectLibrary').click();
  await expect(page.locator('#projectLibraryMessage')).toContainText('Здесь пока нет');
  await page.keyboard.press('Escape');
  await expect(page.locator('#openProjectLibrary')).toBeFocused();
  const image = await page.locator('#mainCanvas').evaluate(c => c.toDataURL());
  await saveNamed(page, 'Утро');
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).locator('img')).toBeVisible();
  await expect.poll(() => cards(page).locator('img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  await cards(page).getByRole('button', { name: 'Переименовать: Утро', exact: true }).click();
  await submitName(page, 'Мой кадр');
  await expect(cards(page).locator('.project-title')).toHaveText('Мой кадр');
  await expect(cards(page).getByRole('button', { name: 'Переименовать: Мой кадр', exact: true })).toBeFocused();
  await cards(page).getByRole('button', { name: 'Создать копию: Мой кадр', exact: true }).click();
  await submitName(page, 'Вариант');
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).first().locator('.project-title')).toHaveText('Вариант');
  await page.keyboard.press('Escape');
  await page.locator('[data-preset="flowers"]').click(); await saved(page);
  await page.locator('#openProjectLibrary').click();
  await cards(page).getByRole('button', { name: 'Открыть: Мой кадр', exact: true }).click();
  await expect(page.locator('#projectLibrary')).not.toBeVisible();
  expect(await page.locator('#mainCanvas').evaluate(c => c.toDataURL())).toBe(image);
  await page.reload(); await saved(page);
  expect(await page.locator('#mainCanvas').evaluate(c => c.toDataURL())).toBe(image);
  await page.locator('#openProjectLibrary').click();
  const card = cards(page).filter({ has: page.locator('.project-title', { hasText: /^Мой кадр$/ }) });
  await card.getByRole('button', { name: 'Удалить: Мой кадр', exact: true }).click();
  await expect(page.locator('#projectEditorDescription')).toContainText('Мой кадр');
  await page.locator('#projectEditorCancel').click();
  await expect(cards(page)).toHaveCount(2);
  await card.getByRole('button', { name: 'Удалить: Мой кадр', exact: true }).click();
  await page.locator('#projectEditorConfirm').click();
  await expect(cards(page)).toHaveCount(1);
  await page.keyboard.press('Escape'); await saved(page);
  await page.reload(); await saved(page);
  await page.locator('#openProjectLibrary').click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).locator('.project-title')).toHaveText('Вариант');
});

test('pending edits survive switching projects and named projects autosave', async ({ page }) => {
  await page.goto('/'); await saved(page);
  await saveNamed(page, 'Первый');
  await page.keyboard.press('Escape');
  await page.locator('[data-preset="flowers"]').click(); await saved(page);
  await saveNamed(page, 'Второй');
  await page.keyboard.press('Escape');
  await page.locator('#refineBox').evaluate(el => { el.open = true; });
  await page.locator('#addCustomPinBtn').click();
  const palette = await page.evaluate(() => window.__chromastyle.palette);
  await page.locator('#openProjectLibrary').click();
  await cards(page).getByRole('button', { name: 'Открыть: Первый', exact: true }).click();
  await expect(page.locator('#projectLibrary')).not.toBeVisible();
  await page.locator('#openProjectLibrary').click();
  await cards(page).getByRole('button', { name: 'Открыть: Второй', exact: true }).click();
  await expect(page.locator('#projectLibrary')).not.toBeVisible();
  expect(await page.evaluate(() => window.__chromastyle.palette)).toEqual(palette);
});

test('stale rename cannot absorb another tab edits and deleting prevents resurrection', async ({ page, context }) => {
  await page.goto('/'); await saved(page);
  await saveNamed(page, 'Общая');
  const other = await context.newPage(); await other.goto('/'); await saved(other);
  await other.locator('#refineBox').evaluate(el => { el.open = true; });
  await other.locator('#addCustomPinBtn').click(); await saved(other);
  await cards(page).getByRole('button', { name: 'Переименовать: Общая', exact: true }).click();
  await page.locator('#projectNameInput').fill('Устаревшая');
  await page.locator('#projectEditorConfirm').click();
  await expect(page.locator('#projectEditorError')).toContainText('другой вкладке');
  await page.locator('#projectEditorCancel').click();
  await page.locator('#refreshProjectLibrary').click();
  await expect(cards(page).locator('.project-title')).toHaveText('Общая');
  await cards(page).getByRole('button', { name: 'Удалить: Общая', exact: true }).click();
  await other.evaluate(() => {
    const schedule = window.setTimeout, cancel = window.clearTimeout;
    const pending = new Map();
    window.setTimeout = (fn, ms, ...args) => {
      if (ms !== 450) return schedule(fn, ms, ...args);
      const id = schedule(() => {}, 60000);
      pending.set(id, () => fn(...args));
      return id;
    };
    window.clearTimeout = id => { pending.delete(id); cancel(id); };
    window.releasePendingAutosaves = () => {
      const callbacks = [...pending.values()];
      for (const id of pending.keys()) cancel(id);
      pending.clear();
      window.setTimeout = schedule; window.clearTimeout = cancel;
      callbacks.forEach(fn => fn());
    };
  });
  await other.locator('#addCustomPinBtn').click();
  await page.locator('#projectEditorConfirm').click();
  await expect(page.locator('#projectLibraryMessage')).toContainText('Здесь пока нет');
  await other.evaluate(() => window.releasePendingAutosaves());
  await expect(other.locator('#projectSaveStatus')).toContainText('Конфликт');
  await page.locator('#refreshProjectLibrary').click();
  await expect(cards(page)).toHaveCount(0);
});

test('dialogs trap focus, render names as text and fit mobile screens', async ({ page }) => {
  await page.goto('/'); await saved(page);
  await saveNamed(page, '<img src=x onerror=alert(1)>');
  await expect(cards(page).locator('.project-title')).toHaveText('<img src=x onerror=alert(1)>');
  expect(await page.locator('#projectLibrary').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  for (let i = 0; i < 10; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement.closest('#projectLibrary') !== null)).toBe(true);
  const result = await new AxeBuilder({ page }).include('#projectLibrary').analyze();
  expect(result.violations.filter(v => ['critical', 'serious'].includes(v.impact))).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('#saveProjectToLibrary')).toBeFocused();
});
