import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });
await page.locator('#openStoriesModalBtn').click();
await page.waitForSelector('#storyStatus.ready', { timeout: 20000 });
for (const tpl of ['editorial', 'polaroid', 'magazine', 'aroma']) {
  await page.locator(`[data-story-template="${tpl}"]`).click();
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const cv = document.getElementById('storyPreview');
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let n = 0, total = 0;
    for (let i = 3; i < d.length; i += 97) { total++; if (d[i] > 128) n++; }
    // bbox of non-bg? find opaque bbox
    let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
    for (let y = 0; y < cv.height; y += 4) for (let x = 0; x < cv.width; x += 4) {
      if (d[(y * cv.width + x) * 4 + 3] > 128) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    return { frac: n / total, w: cv.width, h: cv.height, bbox: [minX, minY, maxX, maxY] };
  });
  console.log(tpl, JSON.stringify(r));
}
console.log('errs:', errs.join('|') || 'none');
await browser.close();
