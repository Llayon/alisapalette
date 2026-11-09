import { preview } from 'vite';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

// Repeatable handler/frame measurements, not a substitute for physical devices.
const output = process.argv[2] || '.verification/performance.json';
const root = process.argv[3] || process.cwd();
const server = await preview({ root, configFile: false, base: './', preview: { host: '127.0.0.1', port: 4175, strictPort: true } });
let browser;
try {
  browser = await chromium.launch();
  const results = [];
  for (const rate of [1, 4]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate });
    await page.goto('http://127.0.0.1:4175');
    await page.locator('#paletteList .pal-main').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    const result = await page.evaluate(async () => {
      const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
      const summarize = values => {
        const sorted = [...values].sort((a, b) => a - b);
        return { median: +sorted[Math.floor(sorted.length / 2)].toFixed(2), p95: +sorted[Math.ceil(sorted.length * 0.95) - 1].toFixed(2), max: +sorted.at(-1).toFixed(2) };
      };
      async function measure(action) {
        const handler = [], nextFrame = [];
        for (let i = 0; i < 35; i++) {
          await frame();
          const start = performance.now();
          action(i);
          const end = performance.now();
          await frame();
          if (i >= 5) { handler.push(end - start); nextFrame.push(performance.now() - start); }
        }
        return { samples: handler.length, handlerMs: summarize(handler), nextFrameMs: summarize(nextFrame) };
      }
      document.querySelector('#paletteList .pal-main').scrollIntoView({ block: 'center' });
      await frame(); await frame();
      const selection = await measure(i => {
        const buttons = document.querySelectorAll('#paletteList .pal-main');
        buttons[i % buttons.length].click();
      });
      document.querySelector('#mainCanvas').scrollIntoView({ block: 'center' });
      await frame(); await frame();
      const photo = document.querySelector('#mainCanvas').getBoundingClientRect();
      const pin = document.querySelector('.color-pin');
      const event = (target, type, x, y) => target.dispatchEvent(new PointerEvent(type, { pointerId: 7, button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true }));
      event(pin, 'pointerdown', photo.x + photo.width / 2, photo.y + photo.height / 2);
      const pinMove = await measure(i => event(pin, 'pointermove', photo.x + photo.width * (0.3 + (i % 10) * 0.03), photo.y + photo.height * (0.3 + (i % 7) * 0.04)));
      event(pin, 'pointerup', 0, 0);
      window.openStoryStudio();
      await new Promise(resolve => setTimeout(resolve, 800));
      const canvas = document.querySelector('#storyPreview');
      const rect = canvas.getBoundingClientRect();
      event(canvas, 'pointerdown', rect.x + rect.width / 2, rect.y + rect.height / 2);
      const crop = await measure(i => event(canvas, 'pointermove', rect.x + rect.width * (0.4 + (i % 9) * 0.02), rect.y + rect.height * (0.4 + (i % 7) * 0.02)));
      event(canvas, 'pointerup', 0, 0);
      return { selection, pinMove, crop };
    });
    results.push({ cpuSlowdown: rate, ...result });
    await page.close();
  }
  const report = { method: 'visible-controls-v2', browser: browser.version(), viewport: '390x844', units: 'milliseconds', results };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  server.httpServer.closeAllConnections();
  await new Promise(resolve => server.httpServer.close(resolve));
}
