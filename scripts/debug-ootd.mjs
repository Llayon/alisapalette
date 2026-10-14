import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.waitForSelector('#paletteList .pal-card');
await page.evaluate(() => window.loadPresetSample('ootd'));
await page.waitForTimeout(400);
const info = await page.evaluate(() => {
  const st = window.__chromastyle;
  const sample = st.sampledPixels;
  // Сколько пикселей выборки — «денимоподобные» (b заметно больше r)?
  let denimLike = 0, burgundyLike = 0;
  for (const p of sample) {
    if (p.b - p.r > 40 && p.g > 80) denimLike++;
    if (p.r > 90 && p.r - p.g > 40 && p.r - p.b > 30) burgundyLike++;
  }
  // Центр canvas 800x600: что реально нарисовано в области джинсов?
  return {
    sampleSize: sample.length,
    denimLike, burgundyLike,
    canvasW: document.getElementById('mainCanvas').width,
    palette: st.palette.map((c) => ({ hex: '#', r: c.r, g: c.g, b: c.b, pct: c.percentage }))
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
