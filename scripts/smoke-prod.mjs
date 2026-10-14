import { chromium } from 'playwright';

const URL = 'https://llayon.github.io/alisapalette/';
const errors = [];
const browser = await chromium.launch();

// Desktop smoke
let page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 150)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 150)); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });
const checks = {};
checks.paletteCards = await page.locator('#paletteList .pal-card').count();
checks.hasCalm = (await page.locator('#harmonyContainer').innerText()).includes('Спокойно');
checks.hasPhoto = (await page.locator('#harmonyContainer').innerText()).includes('Сочетания из вашего фото');
// select second color -> harmony updates
await page.locator('#paletteList .pal-card').nth(1).click();
await page.waitForTimeout(400);
checks.afterSelect = (await page.locator('#harmonyContainer').innerText()).length > 100;
// export modal
await page.locator('#openStoriesModalBtn').click();
await page.waitForTimeout(400);
checks.exportVisible = await page.locator('#exportModal:not(.hidden)').count();
checks.exportCode = (await page.locator('#exportCodeArea').inputValue()).includes('--color-1');
await page.locator('#closeExportBtn').click();
// perfume + products
checks.perfumes = await page.locator('#matchedPerfumesGrid .perf').count();
checks.products = await page.locator('#matchedProductsGrid .prod').count();
// static assets: no 404
const bad = [];
page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
checks.no404 = bad;
await page.screenshot({ path: 'screenshots/prod-desktop.png' });
await page.close();

// Mobile smoke 390x844
page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
page.on('pageerror', (e) => errors.push('m-pageerror: ' + String(e).slice(0, 150)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });
checks.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
checks.mobileCards = await page.locator('#paletteList .pal-card').count();
await page.screenshot({ path: 'screenshots/prod-mobile.png', fullPage: true });
await page.close();

await browser.close();
console.log(JSON.stringify(checks, null, 1));
console.log('JS-ERRORS:', errors.length ? errors.join('\n') : 'none');
