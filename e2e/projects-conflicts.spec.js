import { test, expect } from './fixtures.js';

const saved = page => expect(page.locator('#projectSaveStatus')).toHaveText('Сохранено на устройстве', { timeout: 15000 });
async function addPin(page) {
  await page.locator('#refineBox').evaluate(el => { el.open = true; });
  await page.locator('#addCustomPinBtn').click();
}

test('two tabs resolve conflicts by reloading or saving the latest edits as a copy', async ({ page, context }) => {
  await page.goto('/');
  await saved(page);
  const other = await context.newPage();
  await other.goto('/');
  await saved(other);
  await addPin(page);
  await saved(page);
  const firstCount = await page.evaluate(() => window.__chromastyle.palette.length);
  await addPin(other);
  await expect(other.locator('#projectSaveStatus')).toContainText('Конфликт');
  await other.locator('#reloadProject').click();
  await saved(other);
  expect(await other.evaluate(() => window.__chromastyle.palette.length)).toBe(firstCount);
  await addPin(page);
  await saved(page);
  await addPin(other);
  await expect(other.locator('#projectSaveStatus')).toContainText('Конфликт');
  // A further edit after the first failed write must be included in the copy.
  await addPin(other);
  const latest = await other.evaluate(() => window.__chromastyle.palette);
  await other.locator('#copyConflictedProject').click();
  await saved(other);
  await other.reload();
  await saved(other);
  expect(await other.evaluate(() => window.__chromastyle.palette)).toEqual(latest);
});
