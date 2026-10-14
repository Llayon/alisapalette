/** Скриншоты до/после + 4 обязательные демо-сцены. Запуск: node scripts/screenshots.mjs */
import { chromium } from 'playwright';
import { execSync } from 'child_process';

const SHOTS = 'screenshots';
const AFTER = 'http://127.0.0.1:4173/';
const BEFORE = 'http://127.0.0.1:8099/code_artifact.html';

const browser = await chromium.launch();

async function snap(url, viewport, name, actions = null) {
  const page = await browser.newPage({ viewport });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await page.goto(url, { waitUntil: 'networkidle' });
  if (actions) await actions(page);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  console.log(name, 'errors:', errs.length ? errs.join(' | ') : 'none');
  await page.close();
}

// ДО: исходный прототип (code_artifact.html) — обслуживается vite dev на другом порту
// Сервер корня уже должен быть поднят отдельно; здесь снимаем только ПОСЛЕ.
await snap(BEFORE, { width: 390, height: 844 }, 'before-mobile-coffee');
await snap(BEFORE, { width: 1280, height: 800 }, 'before-desktop-coffee');
await snap(AFTER, { width: 390, height: 844 }, 'after-mobile-interior');
await snap(AFTER, { width: 1280, height: 800 }, 'after-desktop-interior');

for (const preset of ['coffee', 'ootd', 'flowers', 'gray']) {
  await snap(AFTER, { width: 390, height: 844 }, `after-mobile-${preset}`, async (page) => {
    await page.evaluate((p) => window.loadPresetSample(p), preset);
    await page.waitForTimeout(400);
  });
}
// Тайминги пайплайна на дефолтной сцене
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(AFTER, { waitUntil: 'networkidle' });
await page.waitForSelector('#paletteList .pal-card');
console.log('timings:', await page.evaluate(() => document.getElementById('timingsLine').textContent));
console.log('processing:', await page.evaluate(() => document.getElementById('processingTime').textContent));
await page.close();

await browser.close();
console.log('done');
void execSync;
