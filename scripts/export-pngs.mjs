import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });
await page.evaluate(() => window.loadPresetSample('ootd'));
await page.waitForTimeout(500);
await page.locator('#openStoriesModalBtn').click();
await page.waitForSelector('#storyStatus.ready', { timeout: 15000 });
mkdirSync('reference/story-studio', { recursive: true });
for (const tpl of ['editorial', 'polaroid', 'magazine', 'aroma']) {
  await page.locator(`[data-story-template="${tpl}"]`).click();
  await page.waitForSelector('#storyStatus.ready', { timeout: 15000 });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('#savePngBtn').click()
  ]);
  const path = `reference/story-studio/export-${tpl}.png`;
  await download.saveAs(path);
  console.log(tpl, 'saved', path);
}
console.log('errors:', errs.join('|') || 'none');
await browser.close();
