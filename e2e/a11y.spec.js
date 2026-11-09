import { test, expect } from './fixtures.js';
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
    .analyze();
  const critical = results.violations.filter(v => ['critical', 'serious'].includes(v.impact));
  expect(critical.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, failure: n.failureSummary })) }))).toEqual([]);
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
    .analyze();
  const critical = results.violations.filter(v => ['critical', 'serious'].includes(v.impact));
  expect(critical.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, failure: n.failureSummary })) }))).toEqual([]);
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
  const before = await page.locator('.hero-sub').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  const after = await page.locator('.hero-sub').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(after).toBeCloseTo(before * 2, 1);
  await page.evaluate(() => document.querySelectorAll('details').forEach(details => { details.open = true; }));
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 20000 });
  const studioOverflow = await page.locator('.sheet').evaluate(el => el.scrollWidth - el.clientWidth);
  expect(studioOverflow).toBeLessThanOrEqual(2);
  const outside = await page.locator('#exportModal button').evaluateAll(buttons => buttons.filter(button => {
    const rect = button.getBoundingClientRect();
    return rect.width && rect.height && (rect.left < 0 || rect.right > innerWidth + 2);
  }).map(button => button.textContent));
  expect(outside).toEqual([]);
});

test('axe: раскрытые панели без серьёзных нарушений, включая контраст', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#paletteList .pal-main').first()).toBeVisible();
  await page.evaluate(() => document.querySelectorAll('details').forEach(details => { details.open = true; }));
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.filter(v => ['critical', 'serious'].includes(v.impact)).map(v => ({
    id: v.id, nodes: v.nodes.map(n => ({ target: n.target, failure: n.failureSummary }))
  }))).toEqual([]);
});
