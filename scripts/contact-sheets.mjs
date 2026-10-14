/** Contact sheets: 2×2 монтаж 4 шаблонов для сцен. node scripts/contact-sheets.mjs */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

mkdirSync('reference/story-studio', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });

for (const preset of ['ootd', 'flowers', 'coffee', 'gray', 'interior']) {
  await page.evaluate((p) => window.loadPresetSample(p), preset);
  await page.waitForTimeout(600);
  const url = await page.evaluate(() => window.__storyMontage(['editorial', 'polaroid', 'magazine', 'aroma']));
  writeFileSync(`reference/story-studio/contact-${preset}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log('contact', preset, 'ok');
}
console.log('errors:', errs.join('|') || 'none');
await browser.close();
