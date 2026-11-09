import { test, expect } from './fixtures.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

async function studio(page) {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#paletteList .pal-main').first()).toBeVisible();
  await page.locator('#openStoriesModalBtn').click();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 15000 });
}

test('все начертания с кириллицей и латиницей загружаются локально', async ({ page, baseURL }) => {
  const external = [];
  const origin = new URL(baseURL).origin;
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin !== origin) {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await studio(page);
  const loaded = await page.evaluate(async () => {
    const requests = [
      ['Cormorant Garamond', [600, 700]], ['Inter', [400, 500, 600, 700]],
      ['JetBrains Mono', [400, 600, 700]]
    ];
    return Promise.all(requests.flatMap(([family, weights]) => weights.map(async weight => {
      const faces = await document.fonts.load(`${weight} 40px "${family}"`, 'Палитра ChromaStyle #0123456789');
      return { family, weight, faces: faces.length, loaded: faces.every(face => face.status === 'loaded') };
    })));
  });
  expect(loaded).toHaveLength(9);
  for (const font of loaded) {
    expect(font.faces, `${font.family} ${font.weight}`).toBeGreaterThanOrEqual(2);
    expect(font.loaded).toBe(true);
  }
  expect(external).toEqual([]);
});

test('при отказе шрифтов открытка готовится с резервными шрифтами', async ({ page }) => {
  await page.route('**/*.woff2', route => route.abort());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await studio(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'), page.locator('#savePngBtn').click()
  ]);
  expect(download.suggestedFilename()).toMatch(/1080x1920/);
  expect(await download.failure()).toBeNull();
  expect(errors).toEqual([]);
});

test('задержавшиеся шрифты обновляют предпросмотр после резервного рендера', async ({ page }) => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/*.woff2', async route => {
    await pending;
    await route.continue();
  });
  await studio(page); // The bounded font wait must permit a fallback PNG.
  const preview = () => page.locator('#storyPreview').evaluate(canvas => canvas.toDataURL());
  const png = async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download'), page.locator('#savePngBtn').click()
    ]);
    return createHash('sha256').update(readFileSync(await download.path())).digest('hex');
  };
  const fallback = await preview();
  const fallbackPng = await png();
  release();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(preview, { timeout: 15000 }).not.toBe(fallback);
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 15000 });
  expect(await png()).not.toBe(fallbackPng);
});
