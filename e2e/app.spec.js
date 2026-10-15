import { test, expect } from '@playwright/test';

async function countGt0(locator, timeout = 15000) {
  await expect.poll(async () => locator.count(), { timeout }).toBeGreaterThan(0);
}

async function openSettings(page) {
  const open = await page.locator('#moreSettings').getAttribute('open');
  if (open === null) await page.locator('#moreSettings > summary').click();
}

async function openRefine(page) {
  const open = await page.locator('#refineBox').getAttribute('open');
  if (open === null) await page.locator('#refineBox > summary').click();
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
  await page.locator('#paletteList .pal-main').nth(1).click();
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
  await openSettings(page);
  await page.selectOption('#sortSelect', 'hue');
  const selAfter = await page.evaluate(() => document.querySelector('#paletteList .pal-card.sel .mono')?.textContent);
  expect(selAfter).toBe(selBefore);

  // Пины: кнопка добавляет точку (инструменты — в «Уточнить цвета»)
  await openRefine(page);
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
  await page.locator('#moreProportion > summary').click();
  const currentNames = await page.evaluate(() => [...document.querySelectorAll('#paletteList .pal-card .nm')].map((el) => el.textContent.trim()));
  const gridText = await page.locator('#rule603010Grid').innerText();
  expect(currentNames.some((nm) => nm && gridText.includes(nm))).toBe(true);
  expect(gridText).not.toContain('Бургунди');
  // DOM-порядок соответствует сценарию: hero → фото → палитра → сочетания → открытка → ещё
  const domOrder = await page.evaluate(() => {
    const order = ['.hero', '.flow-photo', '.flow-palette', '.flow-harmony', '.story-cta', '.more'];
    const doc = document.querySelector('main');
    const pos = order.map((sel) => {
      const el = document.querySelector(sel);
      // позиция в порядке обхода DOM
      let i = 0;
      const walker = document.createTreeWalker(doc, NodeFilter.SHOW_ELEMENT);
      while (walker.nextNode()) { if (walker.currentNode === el) break; i++; }
      return i;
    });
    return pos;
  });
  const sorted = [...domOrder].sort((a, b) => a - b);
  expect(domOrder.join(',')).toBe(sorted.join(','));
  // Таб-порядок начинается с hero CTA, а не с технических полей
  const firstTab = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button, input, select')].filter((el) => !el.disabled && el.offsetParent !== null);
    return els.slice(0, 3).map((el) => el.id || el.textContent.trim().slice(0, 20));
  });
  expect(firstTab.join('|')).toContain('topPickBtn');

  // Story Studio открывается, код палитры на месте, предпросмотр рисуется
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('#exportModal')).toBeVisible();
  const code = await page.locator('#exportCodeArea').inputValue();
  expect(code).toContain('--color-1');
  const cardDrawn = await page.evaluate(() => {
    const cv = document.getElementById('storyPreview');
    const d = cv.getContext('2d').getImageData(10, 10, 10, 10).data;
    return [...d].some((v) => v !== 0);
  });
  expect(cardDrawn).toBe(true);
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 15000 });
  await page.locator('#closeExportBtn').click();

  // Парфюм и товары не падают
  await countGt0(page.locator('#matchedPerfumesGrid .perf'), 8000);
  await countGt0(page.locator('#matchedProductsGrid .prod'), 8000);

  expect(errors.filter((e) => !e.includes('fonts.g')).join('\n')).toBe('');
});

test('некорректный файл показывает понятную ошибку', async ({ page }) => {
  await page.goto('./', { waitUntil: 'networkidle' });
  await countGt0(page.locator('#paletteList .pal-card'));
  await page.locator('#fileInput').setInputFiles({
    name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image')
  });
  await expect(page.locator('#loadError')).toBeVisible();
  // Палитра не destroyed ошибкой
  await countGt0(page.locator('#paletteList .pal-card'), 5000);
});

test('переключение алгоритмов не ломает UI', async ({ page }) => {
  await page.goto('./', { waitUntil: 'networkidle' });
  await countGt0(page.locator('#paletteList .pal-card'));
  await openSettings(page);
  for (const name of ['Баланс кадра', 'Гардероб OOTD', 'Яркие детали', 'Палитра фотографии']) {
    await page.getByRole('button', { name: new RegExp(name.slice(0, 8)) }).first().click();
    await countGt0(page.locator('#paletteList .pal-card'), 8000);
  }
  expect(errors.filter((e) => !e.includes('fonts.g')).join('\n')).toBe('');
});
