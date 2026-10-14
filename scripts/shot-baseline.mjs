import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  const page = await browser.newPage({ viewport: vp });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 100)));
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });
  await page.locator('#openStoriesModalBtn').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `reference/story-studio/baseline-${vp.width}.png` });
  console.log('baseline', vp.width, errs.join('|') || 'ok');
  await page.close();
}
await browser.close();
