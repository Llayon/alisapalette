import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });
await page.evaluate(() => window.loadPresetSample('ootd'));
await page.waitForTimeout(500);
await page.locator('#openStoriesModalBtn').click();
await page.waitForTimeout(1500);
for (const tpl of ['editorial', 'polaroid', 'magazine', 'aroma']) {
  await page.locator(`[data-story-template="${tpl}"]`).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `reference/story-studio/new-${tpl}-mobile.png` });
  console.log(tpl, 'status:', await page.locator('#storyStatus').innerText());
}
console.log('errors:', errs.join('|') || 'none');
await browser.close();
