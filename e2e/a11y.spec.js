import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const errors = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(String(e)));
});
test.afterEach(() => {
  expect(errors.filter((e) => !String(e).includes('fonts.g')).join('\n')).toBe('');
});

test('axe: главная страница без критических нарушений', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast'])
    .analyze();
  const critical = results.violations.filter((v) => v.impact === 'critical');
  expect(critical.map((v) => v.id).join(',')).toBe('');
  // Контраст проверяем отдельно точечно (WCAG AA вручную для ключевых текстов)
  expect(results.violations.map((v) => v.id).join(',')).not.toContain('html-has-lang');
});

test('axe: Story Studio без критических нарушений', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('#exportModal')).toBeVisible();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 20000 });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast'])
    .analyze();
  const critical = results.violations.filter((v) => v.impact === 'critical');
  expect(critical.map((v) => v.id).join(',')).toBe('');
  await page.keyboard.press('Escape');
  await expect(page.locator('#exportModal')).toBeHidden();
});

test('keyboard: Tab-порядок, активация карточки, фокус модалки', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });
  // Первый Tab — hero CTA
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement.id)).toBe('topPickBtn');
  // Карточка палитры активируется с клавиатуры (Enter)
  const cards = page.locator('#paletteList .pal-main');
  await cards.nth(1).focus();
  const selBefore = await page.evaluate(() => document.querySelector('#paletteList .pal-card.sel .mono')?.textContent);
  await page.keyboard.press('Enter');
  const selAfter = await page.evaluate(() => document.querySelector('#paletteList .pal-card.sel .mono')?.textContent);
  expect(selAfter).not.toBe(selBefore);
  // Модалка: фокус внутри, Escape возвращает
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('#exportModal')).toBeVisible();
  const insideModal = await page.evaluate(() => !!document.activeElement?.closest('#exportModal'));
  expect(insideModal).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#exportModal')).toBeHidden();
  expect(await page.evaluate(() => document.activeElement.id)).toBe('openStoriesModalBtn');
});

test('200% текста: нет горизонтального переполнения', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
