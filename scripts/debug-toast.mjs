import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 200)); });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.waitForSelector('#paletteList .pal-card', { timeout: 15000 });
const n = await page.locator('#harmonyContainer .swrow').count();
console.log('swrows:', n);
await page.locator('#addCustomPinBtn').click();
await page.waitForTimeout(500);
console.log('pins:', await page.locator('.color-pin').count());
await page.locator('#harmonyContainer .swrow').first().click();
await page.waitForTimeout(300);
console.log('toast class:', await page.evaluate(() => document.getElementById('toast').className));
console.log('toast text:', await page.evaluate(() => document.getElementById('toastText').textContent));
await browser.close();
