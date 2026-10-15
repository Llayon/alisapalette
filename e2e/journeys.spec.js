import { test, expect } from '@playwright/test';

// Экспертные UX-сценарии (не user research): число шагов, состояния, ошибки.
const errors = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(String(e)));
});
test.afterEach(() => {
  expect(errors.filter((e) => !String(e).includes('fonts.g')).join('\n')).toBe('');
});

async function gotoReady(page) {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });
}

// Экспертные UX-сценарии (не user research): число шагов, состояния, ошибки.

test('Journey A — первый визит: hero, пример, демо-маркировка', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.hero h1')).toContainText('Найдите цвета');
  await expect(page.locator('#heroPickBtn')).toBeVisible();
  await page.getByRole('button', { name: 'Пионы и пудра' }).click();
  await expect(page.locator('#paletteList .pal-card').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#photoBadge')).toContainText('Пример');
  await expect(page.locator('#photoBadge.demo')).toBeVisible();
});

// Настоящий PNG из canvas (полный путь пользователя: файл → декодирование → анализ)
async function canvasPngBuffer(page) {
  const dataUrl = await page.evaluate(() => document.getElementById('mainCanvas').toDataURL('image/png'));
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  expect(buf.length).toBeGreaterThan(1000);
  return buf;
}

test('Journey B — собственное фото: JPEG/PNG → палитра → сочетания', async ({ page }) => {
  await gotoReady(page);
  const buf = await canvasPngBuffer(page);
  await page.locator('#fileInput').setInputFiles({ name: 'my-photo.png', mimeType: 'image/png', buffer: buf });
  await page.waitForTimeout(1500);
  expect(await page.locator('#paletteList .pal-card').count()).toBeGreaterThanOrEqual(1);
  // Это уже не демо
  await expect(page.locator('#photoBadge.demo')).toHaveCount(0);
  await expect(page.locator('#photoBadge')).toContainText('my-photo.png');
  await expect(page.locator('#harmonyContainer')).toContainText('Спокойно');
});

test('Journey C — открытка: CTA после гармоний → студия → шаблон → PNG', async ({ page }) => {
  await gotoReady(page);
  await expect(page.locator('.story-cta')).toBeVisible();
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 20000 });
  await page.locator('[data-story-template="polaroid"]').click();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 20000 });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.locator('#savePngBtn').click()
  ]);
  expect((await download.path())?.length).toBeGreaterThan(0);
});

test('Journey D — уточнение: инструменты, свой пин сохраняется', async ({ page }) => {
  await gotoReady(page);
  // Инструменты скрыты по умолчанию
  expect(await page.locator('#refineBox').getAttribute('open')).toBe(null);
  await page.locator('#refineBox > summary').click();
  const before = await page.locator('.color-pin').count();
  await page.locator('#addCustomPinBtn').click();
  expect(await page.locator('.color-pin').count()).toBe(before + 1);
  // Скрытие точек не удаляет палитру
  await page.locator('#togglePinsCheckbox').uncheck();
  expect(await page.locator('.color-pin').count()).toBe(0);
  expect(await page.locator('#paletteList .pal-card').count()).toBeGreaterThan(0);
  // Закрытие инструментов сохраняет изменения
  await page.locator('#refineBox > summary').click();
  await page.locator('#refineBox > summary').click();
  expect(await page.locator('#paletteList .pal-card').count()).toBeGreaterThan(0);
  // Переключение сглаживания не ломает палитру
  await page.locator('[data-kernel="5"]').click();
  expect(await page.locator('#paletteList .pal-card').count()).toBeGreaterThan(0);
});

test('Journey E — продвинутый: алгоритм, сортировка, формат, копия HEX', async ({ page }) => {
  await gotoReady(page);
  await page.locator('#moreSettings > summary').click();
  await page.getByRole('button', { name: 'Яркие детали' }).click();
  await expect(page.locator('#paletteList .pal-card').first()).toBeVisible({ timeout: 10000 });
  await page.selectOption('#sortSelect', 'luminance');
  await page.locator('[data-format="rgb"]').click();
  await expect(page.locator('#paletteList .pal-card .mono').first()).toContainText('rgb(');
  await page.locator('#paletteList .pal-card [data-act="copy"]').first().click();
  await expect(page.locator('#toast.show')).toBeVisible({ timeout: 5000 });
});

test('Journey F — ещё идеи: доли, аромат, товары — работают и не мешают', async ({ page }) => {
  await gotoReady(page);
  // Основной сценарий выше — без прокрутки к нишевым блокам
  expect(await page.locator('.flow-palette .pal-card').count()).toBeGreaterThan(0);
  await page.locator('#moreProportion > summary').click();
  expect(await page.locator('#proportionBar > div').count()).toBeGreaterThan(0);
  await page.locator('#morePerfume > summary').click();
  await expect(page.locator('#matchedPerfumesGrid .perf').first()).toBeVisible({ timeout: 8000 });
  // Честная маркировка ассоциации, без процентов-объективности
  await expect(page.locator('#morePerfume')).toContainText('художественная ассоциация');
  await page.locator('#moreProducts > summary').click();
  await expect(page.locator('#matchedProductsGrid .prod').first()).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#moreProducts')).toContainText('Демонстрационная');
});
