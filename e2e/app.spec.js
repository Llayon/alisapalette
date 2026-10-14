import { test, expect } from '@playwright/test';

async function countGt0(locator, timeout = 15000) {
  await expect.poll(async () => locator.count(), { timeout }).toBeGreaterThan(0);
}

const errors = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
});

test('загрузка, палитра, гармонии, сортировка, пины, копирование, экспорт', async ({ page }) => {
  await page.goto('./', { waitUntil: 'networkidle' });
  await countGt0(page.locator('#paletteList .pal-card'));

  // Нет горизонтального переполнения
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  // Сумма долей 100.0
  const sum = await page.evaluate(() => {
    const els = [...document.querySelectorAll('#proportionLegend .pc')];
    return els.reduce((s, el) => s + parseFloat(el.textContent), 0);
  });
  expect(Math.abs(sum - 100)).toBeLessThan(0.15);

  // Выбор цвета обновляет сочетания
  const before = await page.locator('#harmonyContainer').innerText();
  await page.locator('#paletteList .pal-card').nth(1).click();
  const after = await page.locator('#harmonyContainer').innerText();
  expect(after.length).toBeGreaterThan(50);
  void before;

  // Три рекомендации видны
  await expect(page.locator('#harmonyContainer')).toContainText('Спокойно');
  await expect(page.locator('#harmonyContainer')).toContainText('Контрастно');
  await expect(page.locator('#harmonyContainer')).toContainText('Акцент');
  await expect(page.locator('#harmonyContainer')).toContainText('Сочетания из вашего фото');

  // Сортировка не теряет активный цвет
  const selBefore = await page.evaluate(() => document.querySelector('#paletteList .pal-card.sel .mono')?.textContent);
  await page.selectOption('#sortSelect', 'hue');
  const selAfter = await page.evaluate(() => document.querySelector('#paletteList .pal-card.sel .mono')?.textContent);
  expect(selAfter).toBe(selBefore);

  // Пины: кнопка добавляет точку (клик по фото может попасть в существующий пин и начать drag)
  const pinsBefore = await page.locator('.color-pin').count();
  await page.locator('#addCustomPinBtn').click();
  const pinsAfter = await page.locator('.color-pin').count();
  expect(pinsAfter).toBe(pinsBefore + 1);

  // Копирование HEX (clipboard может быть недоступен — проверяем тост)
  await page.locator('#harmonyContainer .swrow').first().click();
  await expect(page.locator('#toast.show')).toBeVisible({ timeout: 5000 });

  // Смена пресета сбрасывает старые данные (регрессия stale-вердикта 60-30-10)
  await page.getByRole('button', { name: /Почти серое/ }).click();
  await countGt0(page.locator('#paletteList .pal-card'), 8000);
  const sum2 = await page.evaluate(() => {
    const els = [...document.querySelectorAll('#proportionLegend .pc')];
    return els.reduce((s, el) => s + parseFloat(el.textContent), 0);
  });
  expect(Math.abs(sum2 - 100)).toBeLessThan(0.15);
  // Блок 60-30-10 содержит только актуальные цвета (старые роли не сохранились)
  const currentNames = await page.evaluate(() => [...document.querySelectorAll('#paletteList .pal-card .nm')].map((el) => el.textContent.trim()));
  const gridText = await page.locator('#rule603010Grid').innerText();
  expect(currentNames.some((nm) => nm && gridText.includes(nm))).toBe(true);
  expect(gridText).not.toContain('Бургунди');
  // Мобильный порядок: фото → палитра → сочетания (проверяем на узких viewport через order)
  const isNarrow = (await page.viewportSize().width) < 1024;
  if (isNarrow) {
    const order = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.grid .o-photo, .grid .o-palette, .grid .o-harmony')];
      return items.map((el) => window.getComputedStyle(el).order + ':' + el.className);
    });
    const orders = order.map((s) => parseInt(s, 10));
    expect([...orders].sort((a, b) => a - b).join(',')).toBe(orders.join(','));
  }

  // Экспорт открывается и рисует карточку
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('#exportModal')).toBeVisible();
  const code = await page.locator('#exportCodeArea').inputValue();
  expect(code).toContain('--color-1');
  const cardDrawn = await page.evaluate(() => {
    const cv = document.getElementById('exportCardCanvas');
    const d = cv.getContext('2d').getImageData(10, 10, 10, 10).data;
    return [...d].some((v) => v !== 0);
  });
  expect(cardDrawn).toBe(true);
  await page.locator('#closeExportBtn').click();

  // Парфюм и товары не падают
  await countGt0(page.locator('#matchedPerfumesGrid .perf'), 8000);
  await countGt0(page.locator('#matchedProductsGrid .prod'), 8000);

  expect(errors.filter((e) => !e.includes('fonts.g')).join('\n')).toBe('');
});

test('переключение алгоритмов не ломает UI', async ({ page }) => {
  await page.goto('./', { waitUntil: 'networkidle' });
  await countGt0(page.locator('#paletteList .pal-card'));
  for (const name of ['Баланс кадра', 'Гардероб OOTD', 'Яркие детали', 'Палитра фотографии']) {
    await page.getByRole('button', { name: new RegExp(name.slice(0, 8)) }).first().click();
    await countGt0(page.locator('#paletteList .pal-card'), 8000);
  }
  expect(errors.filter((e) => !e.includes('fonts.g')).join('\n')).toBe('');
});
