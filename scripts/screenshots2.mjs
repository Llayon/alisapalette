import { chromium } from 'playwright';
const AFTER = 'http://127.0.0.1:4173/';
const browser = await chromium.launch();
async function snap(viewport, name, preset) {
  const page = await browser.newPage({ viewport });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await page.goto(AFTER, { waitUntil: 'networkidle' });
  await page.evaluate((p) => window.loadPresetSample(p), preset);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  console.log(name, 'errors:', errs.length ? errs.join(' | ') : 'none');
  await page.close();
}
await snap({ width: 390, height: 844 }, 'after-mobile-flowers', 'flowers');
await snap({ width: 390, height: 844 }, 'after-mobile-gray', 'gray');
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(AFTER, { waitUntil: 'networkidle' });
await page.waitForSelector('#paletteList .pal-card');
console.log('timings:', await page.evaluate(() => document.getElementById('timingsLine').textContent));
console.log('processing:', await page.evaluate(() => document.getElementById('processingTime').textContent));
await page.close();
await browser.close();
console.log('done');
