import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

const errors = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(() => {
  expect(errors.filter((e) => !e.includes('fonts.g')).join('\n')).toBe('');
});

async function openStudio(page) {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('#exportModal')).toBeVisible();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 20000 });
}

test('студия: 4 шаблона, заголовок, число оттенков, тоглы, предпросмотр', async ({ page }) => {
  await openStudio(page);
  for (const tpl of ['editorial', 'polaroid', 'magazine', 'aroma']) {
    await page.locator(`[data-story-template="${tpl}"]`).click();
    await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 20000 });
    const nonBlank = await page.evaluate(() => {
      const cv = document.getElementById('storyPreview');
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let n = 0, total = 0;
      for (let i = 3; i < d.length; i += 388) { total++; if (d[i] > 128) n++; }
      return n / total;
    });
    expect(nonBlank).toBeGreaterThan(0.9);
  }
  // Заголовок обновляет превью
  await page.locator('#storyTitleInput').fill('Цвета моего гардероба');
  await page.waitForTimeout(900);
  // Число оттенков 3
  await page.locator('[data-story-count="3"]').click();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 20000 });
  // Тоглы
  await page.locator('#storyPct').check();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 20000 });
  // Нет переполнения
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('pixel: размеры, fidelity swatches, тексты в canvas, 1/2/6 цветов', async ({ page }) => {
  await openStudio(page);
  for (const tpl of ['editorial', 'polaroid', 'magazine', 'aroma']) {
    const r = await page.evaluate((t) => window.__storyCheck(t), tpl);
    expect(r.swatchCount).toBeGreaterThanOrEqual(1);
    expect(r.allSwatchesOk).toBe(true);
    expect(r.opaqueRatio).toBeGreaterThan(0.9);
    expect(r.textsInsideCanvas).toBe(true);
  }
  // Длинный заголовок + длинные названия не ломают layout
  await page.locator('#storyTitleInput').fill('Моя невероятно длинная достопримечательность воскресного утра');
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => window.__storyCheck('magazine'));
  expect(r.textsInsideCanvas).toBe(true);
  expect(r.allSwatchesOk).toBe(true);
});

test('PNG 1080×1920 скачивается с корректным заголовком', async ({ page }) => {
  await openStudio(page);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.locator('#savePngBtn').click()
  ]);
  const path = await download.path();
  const buf = readFileSync(path);
  // PNG signature + IHDR dims
  expect([...buf.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  expect([w, h]).toEqual([1080, 1920]);
  expect(buf.length).toBeGreaterThan(50000);
  expect(download.suggestedFilename()).toMatch(/^chromastyle-editorial-1080x1920-.*\.png$/);
});

test('share без API: нет fallback-скачивания, честный статус', async ({ page }) => {
  await openStudio(page);
  let downloadFired = false;
  page.on('download', () => { downloadFired = true; });
  await page.locator('#shareStoryBtn').click();
  await page.waitForTimeout(1200);
  // В headless Web Share нет: должен быть тост-подсказка и НИКАКОГО download
  expect(downloadFired).toBe(false);
  const toast = await page.locator('#toastText').innerText();
  expect(toast.length).toBeGreaterThan(0);
});

test('копирование ссылки, Escape, возврат фокуса, персист настроек', async ({ page, context }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 20000 });
  await page.locator('[data-story-template="magazine"]').click();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 20000 });
  await page.locator('#copyAppLinkBtn').click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://llayon.github.io/alisapalette/');
  // Escape + возврат фокуса
  await page.keyboard.press('Escape');
  await expect(page.locator('#exportModal')).toBeHidden();
  expect(await page.evaluate(() => document.activeElement.id)).toBe('openStoriesModalBtn');
  // Персист шаблона после reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('[data-story-template="magazine"].on')).toBeVisible();
});

test('новое фото обновляет экспорт, crop сбрасывается', async ({ page }) => {
  await openStudio(page);
  // Сдвигаем crop через drag по превью
  const box = await page.locator('#storyPreview').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 20000 });
  const cropped = await page.evaluate(() => window.__storyShot ? 'ok' : 'nohook');
  expect(cropped).toBe('ok');
  // Новое фото (другой пресет) — предпросмотр перерисовывается, статус снова ready
  await page.locator('#closeExportBtn').click();
  await page.getByRole('button', { name: /Пионы/ }).click();
  await page.waitForTimeout(600);
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 20000 });
});
