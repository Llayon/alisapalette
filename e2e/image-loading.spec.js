import { test, expect } from './fixtures.js';
import { createHash } from 'node:crypto';

async function ready(page) {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#paletteList .pal-main').first()).toBeVisible();
}

test('повреждённый PNG не заменяет фото, палитру и выделение', async ({ page }) => {
  await ready(page);
  const snapshot = () => page.evaluate(() => ({
    photo: document.getElementById('mainCanvas').toDataURL(),
    palette: JSON.stringify(window.__chromastyle.palette),
    selected: window.__chromastyle.selectedColorId,
    badge: document.getElementById('photoBadge').textContent
  }));
  const before = await snapshot();
  await page.locator('#fileInput').setInputFiles({ name: 'broken.png', mimeType: 'image/png',
    buffer: Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]) });
  await expect(page.locator('#loadError')).toBeVisible();
  expect(await snapshot()).toEqual(before);
});

test('ошибка анализа сохраняет предыдущую фотографию и палитру', async ({ page }) => {
  await ready(page);
  const snapshot = () => page.evaluate(() => ({
    photo: document.getElementById('mainCanvas').toDataURL(),
    palette: JSON.stringify(window.__chromastyle.palette),
    label: document.getElementById('photoBadge').textContent,
    selected: window.__chromastyle.selectedColorId
  }));
  const before = await snapshot();
  await page.evaluate(() => {
    window.createImageBitmap = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 100;
      canvas.getContext('2d').fillRect(0, 0, 100, 100);
      return canvas;
    };
    const original = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (...args) {
      CanvasRenderingContext2D.prototype.getImageData = original;
      throw new Error('controlled analysis failure');
    };
  });
  await page.locator('#fileInput').setInputFiles({ name: 'failure.png', mimeType: 'image/png', buffer: Buffer.from('controlled decode') });
  await expect(page.locator('#loadError')).toBeVisible();
  expect(await snapshot()).toEqual(before);
});

test('ошибка анализа примера сохраняет прежние размеры и фотографию', async ({ page }) => {
  await ready(page);
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 100;
    canvas.getContext('2d').fillRect(0, 0, 100, 100);
    return canvas.toDataURL().split(',')[1];
  });
  await page.locator('#fileInput').setInputFiles({ name: 'small.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
  await expect(page.locator('#photoBadge')).toHaveText('small.png');
  const result = await page.evaluate(() => {
    const snapshot = () => ({
      photo: document.querySelector('#mainCanvas').toDataURL(),
      dimensions: document.querySelector('#imageDimensions').textContent,
      palette: JSON.stringify(window.__chromastyle.palette),
      label: document.querySelector('#photoBadge').textContent
    });
    const before = snapshot();
    const original = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = () => { throw new Error('controlled demo failure'); };
    let error;
    try { window.loadPresetSample('flowers'); } catch (failure) { error = failure.message; }
    finally { CanvasRenderingContext2D.prototype.getImageData = original; }
    return { before, after: snapshot(), error };
  });
  expect(result.error).toBe('controlled demo failure');
  expect(result.after).toEqual(result.before);
});

test('последний файл и пример отменяют устаревшие загрузки', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    window.pendingPhotos = {};
    window.closedPhotos = [];
    window.createImageBitmap = file => new Promise(resolve => {
      window.pendingPhotos[file.name] = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 100;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = file.name === 'first.png' ? 'red' : 'blue';
        ctx.fillRect(0, 0, 100, 100);
        canvas.close = () => window.closedPhotos.push(file.name);
        resolve(canvas);
      };
    });
  });
  const upload = name => page.locator('#fileInput').setInputFiles({ name, mimeType: 'image/png', buffer: Buffer.from('controlled decode') });
  await upload('first.png'); await upload('second.png');
  await page.evaluate(() => window.pendingPhotos['second.png']());
  await expect(page.locator('#photoBadge')).toHaveText('second.png');
  await page.evaluate(() => window.pendingPhotos['first.png']());
  await expect.poll(() => page.evaluate(() => window.closedPhotos.length)).toBe(2);
  await expect(page.locator('#photoBadge')).toHaveText('second.png');
  await upload('third.png');
  await page.locator('[data-preset="flowers"]').click();
  const label = await page.locator('#photoBadge').textContent();
  await page.evaluate(() => window.pendingPhotos['third.png']());
  await expect.poll(() => page.evaluate(() => window.closedPhotos.length)).toBe(3);
  await expect(page.locator('#photoBadge')).toHaveText(label);
  await expect(page.locator('#photoBadge')).toHaveClass(/demo/);
});

test('выбор примера сбрасывает фактическое кадрирование открытки', async ({ page }) => {
  await ready(page);
  await page.locator('[data-preset="flowers"]').click();
  const open = async () => {
    await page.locator('#openStoriesModalBtn').click();
    await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 20000 });
  };
  const preview = async () => createHash('sha256').update(await page.locator('#storyPreview').evaluate(canvas => canvas.toDataURL())).digest('hex');
  await open(); const original = await preview();
  await page.locator('#storyPreview').scrollIntoViewIfNeeded();
  const box = await page.locator('#storyPreview').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 80, { steps: 3 });
  await page.mouse.up();
  await expect(page.locator('#storyStatus.ready')).toBeVisible({ timeout: 20000 });
  expect(await preview()).not.toBe(original);
  await page.locator('#closeExportBtn').click();
  await page.locator('[data-preset="flowers"]').click();
  await open();
  expect(await preview()).toBe(original);
});
