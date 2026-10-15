import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('reference/g4-after', { recursive: true });
const browser = await chromium.launch();
for (const preset of ['ootd', 'flowers', 'coffee']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 80)));
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });
  await page.getByRole('button', { name: new RegExp({ ootd: 'Образ дня', flowers: 'Пионы', coffee: 'тренний латте' }[preset]) }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `reference/g4-after/scene-${preset}.png`, fullPage: true });
  console.log(preset, 'errs=' + (errs.join('|') || 'none'));
  await page.close();
}
await browser.close();
