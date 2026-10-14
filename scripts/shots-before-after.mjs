/** Before(prod bd371b8)/after(local) пары одних и тех же пресетов. */
import { chromium } from 'playwright';

const browser = await chromium.launch();
async function shots(url, tag) {
  for (const preset of ['coffee', 'ootd', 'flowers']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 100)));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });
    await page.evaluate((p) => window.loadPresetSample(p), preset);
    await page.waitForTimeout(600);
    await page.locator('#harmonyContainer').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `reference/shots/${tag}-${preset}-harmony.png` });
    console.log(tag, preset, 'errors:', errs.join('|') || 'none');
    await page.close();
  }
}
await shots('https://llayon.github.io/alisapalette/', 'before');
await shots('http://127.0.0.1:4173/', 'after');
await browser.close();
console.log('done');
