import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.waitForSelector('#paletteList .pal-card', { timeout: 15000 });
const bad = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width > vw + 1 || r.right > vw + 1 || r.left < -1) {
      const cls = el.className && el.className.baseVal === undefined ? String(el.className).slice(0, 60) : '';
      out.push(`${el.tagName}.${cls} w=${Math.round(r.width)} l=${Math.round(r.left)} r=${Math.round(r.right)} :: ${el.textContent.slice(0, 40)}`);
    }
  }
  return { vw, docW: document.documentElement.scrollWidth, bad: out.slice(0, 30) };
});
console.log(JSON.stringify(bad, null, 1));
await browser.close();
