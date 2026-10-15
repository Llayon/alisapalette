import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });
await page.waitForTimeout(1500);
const times = [];
for (let i = 0; i < 5; i++) {
  const t = Date.now();
  await page.locator('#paletteList .pal-main').nth(i % 3).click();
  await page.waitForTimeout(150);
  times.push(Date.now() - t);
}
console.log('G4-fixed', times.join('/'));
await browser.close();
