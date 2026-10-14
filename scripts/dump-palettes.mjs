import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.waitForSelector('#paletteList .pal-card');
for (const preset of ['coffee', 'ootd', 'flowers', 'interior', 'gray']) {
  await page.evaluate((p) => window.loadPresetSample(p), preset);
  await page.waitForTimeout(400);
  const data = await page.evaluate(() => [...document.querySelectorAll('#paletteList .pal-card')].map((el) => el.innerText.replace(/\n/g, ' | ')));
  const sum = await page.evaluate(() => [...document.querySelectorAll('#proportionLegend .pc')].reduce((s, el) => s + parseFloat(el.textContent), 0));
  console.log('=== ' + preset + ' sum=' + sum.toFixed(1));
  data.forEach((d) => console.log('  ' + d));
}
await browser.close();
