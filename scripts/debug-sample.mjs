import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#paletteList .pal-card', { timeout: 15000 });
await page.evaluate(() => window.loadPresetSample('ootd'));
await page.waitForTimeout(300);
const r = await page.evaluate(() => {
  const src = document.getElementById('mainCanvas');
  const t = document.createElement('canvas');
  t.width = 200; t.height = 150;
  const c = t.getContext('2d', { willReadFrequently: true });
  c.drawImage(src, 0, 0, 200, 150);
  const d = c.getImageData(0, 0, 200, 150).data;
  let den = 0, bur = 0, milk = 0, trench = 0;
  for (let i = 0; i < d.length; i += 4) {
    const R = d[i], G = d[i + 1], B = d[i + 2];
    if (B - R > 40 && G > 80) den++;
    if (R > 90 && R - G > 40 && R - B > 30) bur++;
    if (R > 235 && G > 235 && B > 225) milk++;
    if (Math.abs(R - 189) < 25 && Math.abs(G - 162) < 25 && Math.abs(B - 133) < 25) trench++;
  }
  return { total: d.length / 4, den, bur, milk, trench };
});
console.log(JSON.stringify(r));
await browser.close();
