/** Gap-verify §12-13: 1 цвет, 2 цвета, портретное фото 600×900. */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });

async function checkAll(label) {
  for (const tpl of ['editorial', 'polaroid', 'magazine', 'aroma']) {
    const r = await page.evaluate((t) => window.__storyCheck(t), tpl);
    const ok = r.allSwatchesOk && r.textsInsideCanvas && r.opaqueRatio > 0.9;
    console.log(`${label}/${tpl}: n=${r.swatchCount} ok=${ok}`);
    if (!ok) { console.log('  detail:', JSON.stringify(r.swatches.map((s) => s.ok))); process.exitCode = 1; }
  }
}

// 1 цвет
await page.locator('#colorCountSlider').fill('1');
await page.waitForTimeout(800);
console.log('palette size:', await page.locator('#paletteList .pal-card').count());
await checkAll('one-color');

// 2 цвета
await page.locator('#colorCountSlider').fill('2');
await page.waitForTimeout(800);
console.log('palette size:', await page.locator('#paletteList .pal-card').count());
await checkAll('two-color');
await page.locator('#colorCountSlider').fill('6');
await page.waitForTimeout(800);

// Портрет 600×900
await page.evaluate(() => {
  const cv = document.getElementById('mainCanvas');
  cv.width = 600; cv.height = 900;
  const c = cv.getContext('2d');
  c.fillStyle = '#F8F1E5'; c.fillRect(0, 0, 600, 900);
  c.fillStyle = '#4A7098'; c.fillRect(60, 300, 480, 320);
  c.fillStyle = '#621626';
  c.beginPath(); c.roundRect(170, 660, 260, 140, 28); c.fill();
  c.fillStyle = '#BDA285'; c.fillRect(60, 60, 200, 160);
  document.getElementById('imageDimensions').textContent = '600 × 900 px (портрет-тест)';
});
await page.locator('#recalculateBtn').click();
await page.waitForTimeout(800);
console.log('portrait palette:', await page.evaluate(() => [...document.querySelectorAll('#paletteList .pal-card')].map((el) => el.innerText.replace(/\n/g, ' | ')).join(' ;; ')));
await checkAll('portrait');
await page.locator('#openStoriesModalBtn').click();
await page.waitForSelector('#storyStatus.ready', { timeout: 20000 });
await page.locator('[data-story-template="magazine"]').click();
await page.waitForTimeout(800);
await page.screenshot({ path: 'reference/story-studio/verify-portrait-studio.png' });
console.log('errors:', errs.join('|') || 'none');
await browser.close();
