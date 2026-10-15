import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const DIR = process.env.SHOTS_DIR || 'reference/g4-baseline';
mkdirSync(DIR, { recursive: true });
const browser = await chromium.launch();
const viewports = [
  [320, 700], [360, 800], [390, 844], [430, 932], [768, 1024], [1280, 800], [1440, 900]
];
for (const [w, h] of viewports) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 80)));
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: `${DIR}/top-${w}x${h}.png` });
  // tab order sample: first 12 focusable
  const tabOrder = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button, input, select, textarea, a[href], [tabindex]')].filter((el) => !el.disabled && el.offsetParent !== null);
    return els.slice(0, 14).map((el) => (el.tagName + '#' + (el.id || '') + '.' + String(el.className).split(' ')[0]).slice(0, 44));
  });
  console.log(`${w}x${h} overflow=${overflow} errs=${errs.join('|') || 'none'}`);
  console.log('  tab:', tabOrder.join(' > '));
  await page.close();
}
await browser.close();
