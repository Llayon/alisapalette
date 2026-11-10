import { test, expect } from './fixtures.js';
import { readFileSync } from 'node:fs';
import { firefox, webkit } from 'playwright';

const saved = page => expect(page.locator('#projectSaveStatus')).toHaveText('Сохранено на устройстве', { timeout: 15000 });
const cards = page => page.locator('#projectLibraryGrid .project-card');
async function download(page, button) {
  const [file] = await Promise.all([page.waitForEvent('download'), button.click()]);
  expect(file.suggestedFilename()).toMatch(/\.chromastyle\.json$/);
  return readFileSync(await file.path());
}
async function importFile(page, buffer) {
  await page.locator('#projectFileInput').setInputFiles({ name: 'palette.chromastyle.json', mimeType: 'application/json', buffer });
}
async function namedSource(page) {
  await page.goto('/'); await saved(page);
  const photo = await page.locator('#mainCanvas').evaluate(c => c.toDataURL());
  await page.locator('#fileInput').setInputFiles({ name: 'my-photo.png', mimeType: 'image/png', buffer: Buffer.from(photo.split(',')[1], 'base64') });
  await expect(page.locator('#photoBadge')).toHaveText('my-photo.png');
  await page.locator('#refineBox').evaluate(el => { el.open = true; });
  await page.locator('#addCustomPinBtn').click();
  await page.locator('#openStoriesModalBtn').click();
  await page.locator('#storyTitleInput').fill('Сохранённый кадр');
  await page.locator('[data-story-template="polaroid"]').click();
  await page.locator('#storyPreview').focus(); await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await page.locator('#saveProjectToLibrary').click();
  await page.locator('#projectNameInput').fill('Переносимая палитра');
  await page.locator('#projectEditorConfirm').click();
  await expect(cards(page)).toHaveCount(1);
  return download(page, cards(page).getByRole('button', { name: 'Скачать проект: Переносимая палитра', exact: true }));
}

test('file transfer preserves image and edits, imports new identities and leaves current work intact', async ({ page, browser }) => {
  const bytes = await namedSource(page), source = JSON.parse(bytes);
  const context = await browser.newContext();
  try {
    const target = await context.newPage(); await target.goto(new URL(page.url()).origin); await saved(target);
    const before = await target.evaluate(() => window.__chromastyle.palette);
    await target.locator('#openProjectLibrary').click();
    await importFile(target, bytes); await expect(cards(target)).toHaveCount(1);
    expect(await target.evaluate(() => window.__chromastyle.palette)).toEqual(before);
    const first = JSON.parse(await download(target, cards(target).first().getByRole('button', { name: 'Скачать проект:', exact: false })));
    expect(first.project.id).not.toBe(source.project.id);
    expect(first.project.palette).toEqual(source.project.palette);
    expect(first.project.story).toEqual(source.project.story);
    expect(first.image).toEqual(source.image);
    await importFile(target, bytes); await expect(cards(target)).toHaveCount(2);
    const second = JSON.parse(await download(target, cards(target).first().getByRole('button', { name: 'Скачать проект:', exact: false })));
    expect(second.project.id).not.toBe(first.project.id);
    await cards(target).first().getByRole('button', { name: 'Открыть:', exact: false }).click();
    await expect(target.locator('#projectLibrary')).not.toBeVisible();
    expect(await target.evaluate(() => window.__chromastyle.palette)).toEqual(source.project.palette);
    await expect(target.locator('#photoBadge')).toHaveText('my-photo.png');
    await target.locator('#openStoriesModalBtn').click();
    await expect(target.locator('#storyTitleInput')).toHaveValue(source.project.story.title);
    await expect(target.locator('[data-story-template="polaroid"]')).toHaveAttribute('aria-pressed', 'true');
  } finally { await context.close(); }
});

test('invalid files and failed writes never change the current work or add partial projects', async ({ page }) => {
  await page.goto('/'); await saved(page);
  const bytes = await download(page, page.locator('#downloadCurrentProject'));
  const valid = JSON.parse(bytes);
  const before = await page.evaluate(() => ({ palette: window.__chromastyle.palette,
    image: document.getElementById('mainCanvas').toDataURL() }));
  await page.locator('#openProjectLibrary').click();
  await expect(page.locator('#projectLibraryMessage')).toContainText('Здесь пока нет');
  const invalid = [Buffer.from('{'), Buffer.from(JSON.stringify({ ...valid, formatVersion: 2 })),
    Buffer.from(JSON.stringify({ ...valid, project: { ...valid.project, photo: { ...valid.project.photo, width: 1 } } })),
    Buffer.from(JSON.stringify({ ...valid, image: { ...valid.image, data: Buffer.from(valid.image.data, 'base64').subarray(0, 33).toString('base64') } }))];
  for (const file of invalid) {
    await importFile(page, file); await expect(page.locator('#projectLibraryError')).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
  }
  await page.evaluate(() => {
    const input = document.getElementById('projectFileInput'), transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(24 * 1024 * 1024 + 1)], 'large.json', { type: 'application/json' }));
    input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('#projectLibraryError')).toContainText('24 МБ');
  await page.evaluate(() => {
    window.originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'contents') throw new DOMException('Full', 'QuotaExceededError');
      return window.originalPut.apply(this, args);
    };
  });
  await importFile(page, bytes); await expect(page.locator('#projectLibraryError')).toContainText('Недостаточно места');
  await page.evaluate(() => { IDBObjectStore.prototype.put = window.originalPut; });
  await page.locator('#refreshProjectLibrary').click();
  await expect(page.locator('#projectLibraryMessage')).toContainText('Здесь пока нет');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => ({ palette: window.__chromastyle.palette,
    image: document.getElementById('mainCanvas').toDataURL() }))).toEqual(before);
  await saved(page); await page.reload(); await saved(page);
  expect(await page.evaluate(() => window.__chromastyle.palette)).toEqual(before.palette);
});

test('current project can be backed up with the latest edits when autosave fails', async ({ page }) => {
  await page.goto('/'); await saved(page);
  await page.evaluate(() => {
    window.originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'session') throw new DOMException('Full', 'QuotaExceededError');
      return window.originalPut.apply(this, args);
    };
  });
  await page.locator('#refineBox').evaluate(el => { el.open = true; });
  await page.locator('#addCustomPinBtn').click();
  await expect(page.locator('#projectSaveStatus')).toContainText('Не удалось сохранить');
  const palette = await page.evaluate(() => window.__chromastyle.palette);
  const file = JSON.parse(await download(page, page.locator('#downloadCurrentProject')));
  expect(file.project.palette).toEqual(palette);
  await expect(page.locator('#projectTransferStatus')).toContainText('подготовлен');
  await expect(page.locator('#projectSaveStatus')).not.toHaveText('Сохранено на устройстве');
});

test('project files transfer between different browser engines', async ({ page }, testInfo) => {
  const bytes = await namedSource(page), source = JSON.parse(bytes);
  const engine = testInfo.project.name === 'webkit-smoke' ? firefox : webkit;
  const other = await engine.launch();
  try {
    const target = await other.newPage(); await target.goto(new URL(page.url()).origin); await saved(target);
    await target.locator('#openProjectLibrary').click();
    await importFile(target, bytes); await expect(cards(target)).toHaveCount(1);
    const result = JSON.parse(await download(target, cards(target).getByRole('button', { name: 'Скачать проект:', exact: false })));
    expect(result.image).toEqual(source.image);
    expect(result.project.palette).toEqual(source.project.palette);
    expect(result.project.story).toEqual(source.project.story);
    await cards(target).getByRole('button', { name: 'Открыть:', exact: false }).click();
    await expect(target.locator('#projectLibrary')).not.toBeVisible();
    expect(await target.evaluate(() => window.__chromastyle.palette)).toEqual(source.project.palette);
  } finally { await other.close(); }
});
