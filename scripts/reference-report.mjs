/** Отчёт по эталонному набору: палитры + гармонии + скриншоты. node scripts/reference-report.mjs */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#paletteList .pal-card', { timeout: 20000 });

const { SCENES } = await import('../tests/reference-scenes.js');
const report = {};
for (const [name, scene] of Object.entries(SCENES)) {
  // Рисуем сцену попиксельно на mainCanvas 400x300, затем анализ
  await page.evaluate(({ fnSrc }) => {
    // eslint-disable-next-line no-eval
    const fn = eval(`(${fnSrc})`);
    const cv = document.getElementById('mainCanvas');
    cv.width = 400; cv.height = 300;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(400, 300);
    for (let y = 0; y < 300; y++) for (let x = 0; x < 400; x++) {
      const [r, g, b] = fn(x / 400, y / 300);
      const i = (y * 400 + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    document.getElementById('imageDimensions').textContent = '400 × 300 px (эталон)';
  }, { fnSrc: scene.fn.toString() });
  // putImageData не триггерит анализ — вызываем через смену пресета? Нет: напрямую нельзя.
  // Хак: клик «Обновить» вызывает analyzeImagePalette на текущем canvas.
  await page.locator('#recalculateBtn').click();
  await page.waitForTimeout(500);
  const pal = await page.evaluate(() => [...document.querySelectorAll('#paletteList .pal-card')].map((el) => el.innerText.replace(/\n/g, ' | ')));
  const sum = await page.evaluate(() => [...document.querySelectorAll('#proportionLegend .pc')].reduce((s, el) => s + parseFloat(el.textContent), 0));
  const harm = await page.evaluate(() => document.getElementById('harmonyContainer').innerText.slice(0, 600));
  report[name] = { desc: scene.desc, sum: Number(sum.toFixed(1)), palette: pal, harmonyHead: harm };
  console.log(`=== ${name} sum=${sum.toFixed(1)} n=${pal.length}`);
  pal.forEach((p) => console.log('  ' + p));
  await page.screenshot({ path: `reference/shots/${name}.png` });
}
mkdirSync('reference', { recursive: true });
writeFileSync('reference/report.json', JSON.stringify(report, null, 1));
console.log('errors:', errors.join(' | ') || 'none');
await browser.close();
