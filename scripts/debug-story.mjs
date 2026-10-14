import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });
await page.evaluate(() => window.loadPresetSample('ootd'));
await page.waitForTimeout(500);
for (const tpl of ['editorial', 'polaroid', 'magazine', 'aroma']) {
  const r = await page.evaluate((t) => window.__storyCheck(t), tpl);
  console.log(tpl, 'count=', r.swatchCount, 'allOk=', r.allSwatchesOk, 'opaque=', r.opaqueRatio.toFixed(2), 'texts=', r.textsInsideCanvas);
  for (const s of r.swatches) if (!s.ok) console.log('  MISMATCH want', s.want, 'got', s.got);
}
console.log('errs:', errs.join('|') || 'none');
await browser.close();
