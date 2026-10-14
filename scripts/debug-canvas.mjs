import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#paletteList .pal-card', { timeout: 15000 });
await page.evaluate(() => window.loadPresetSample('ootd'));
await page.waitForTimeout(300);
const probe = await page.evaluate(() => {
  const cv = document.getElementById('mainCanvas');
  const c = cv.getContext('2d');
  const pts = [[590, 405], [300, 460], [200, 200], [400, 200], [100, 100]];
  return pts.map(([x, y]) => ({ x, y, px: [...c.getImageData(x, y, 1, 1).data].slice(0, 3) }));
});
console.log(JSON.stringify(probe));
console.log('errs:', errs.join(' | ') || 'none');
await browser.close();
