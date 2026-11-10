import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { projectFixture } from '../tests/project-fixture.js';

const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const schemaURL = moduleURL(readFileSync(new URL('../src/projects/schema.js', import.meta.url), 'utf8'));
const storageURL = moduleURL(readFileSync(new URL('../src/projects/storage.js', import.meta.url), 'utf8')
  .replace("'./schema.js'", JSON.stringify(schemaURL)));

test('version changes release the old connection without overwriting a newer database', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async ({ url, input }) => {
    const { createProjectStorage } = await import(url);
    const name = `test-${crypto.randomUUID()}`, storage = createProjectStorage({ name });
    await storage.save(input, new Blob(['original'], { type: 'image/png' }));
    const upgraded = await new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 2);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    let error;
    try { await storage.list(); } catch (failure) { error = failure.name; }
    const entries = await new Promise((resolve, reject) => {
      const request = upgraded.transaction('projects').objectStore('projects').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    upgraded.close(); storage.close();
    return { error, count: entries.length, id: entries[0].id };
  }, { url: storageURL, input: projectFixture() });
  expect(result).toEqual({ error: 'VersionError', count: 1, id: projectFixture().id });
});

test('projects persist blobs, protect revisions and atomically remove last session', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async ({ url, input }) => {
    const { createProjectStorage } = await import(url);
    const storage = createProjectStorage({ name: `test-${crypto.randomUUID()}` });
    const image = new Blob(['original-image'], { type: 'image/png' });
    const first = await storage.save(input, image);
    storage.close();
    const reopened = await storage.get(input.id);
    const updated = await storage.save({ ...first, name: 'Обновлено', updatedAt: 3 }, undefined, first.revision);
    let conflict;
    try { await storage.save({ ...first, name: 'Stale' }, image, first.revision); }
    catch (error) { conflict = error.name; }
    const afterConflict = await storage.get(input.id);
    const list = await storage.list();
    const last = await storage.lastProjectId();
    let deleteConflict;
    try { await storage.remove(input.id, first.revision); }
    catch (error) { deleteConflict = error.name; }
    await storage.remove(input.id, updated.revision);
    const removed = await storage.get(input.id), lastAfterDelete = await storage.lastProjectId();
    storage.close();
    return { first, reopened: reopened.project, image: await reopened.image.text(), updated,
      conflict, deleteConflict, afterConflict: afterConflict.project, list, last, removed, lastAfterDelete };
  }, { url: storageURL, input: projectFixture() });
  expect(result.first.revision).toBe(1);
  expect(result.reopened).toEqual(result.first);
  expect(result.image).toBe('original-image');
  expect(result.updated.revision).toBe(2);
  expect(result.conflict).toBe('ProjectConflictError');
  expect(result.deleteConflict).toBe('ProjectConflictError');
  expect(result.afterConflict.name).toBe('Обновлено');
  expect(result.list).toHaveLength(1);
  expect(result.list[0]).not.toHaveProperty('image');
  expect(result.last).toBe(result.first.id);
  expect(result.removed).toBeNull();
  expect(result.lastAfterDelete).toBeNull();
});

test('failed creation leaves no metadata or last-project pointer', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async ({ url, input }) => {
    const { createProjectStorage } = await import(url);
    const storage = createProjectStorage({ name: `test-${crypto.randomUUID()}` });
    let error;
    try { await storage.save(input); } catch (failure) { error = failure.message; }
    const list = await storage.list(), last = await storage.lastProjectId();
    storage.close();
    return { error, list, last };
  }, { url: storageURL, input: projectFixture() });
  expect(result.error).toBe('Project image required');
  expect(result.list).toEqual([]);
  expect(result.last).toBeNull();
});

test('a failed transaction rolls back an existing project and concurrent writers cannot overwrite each other', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async ({ url, input }) => {
    const { createProjectStorage } = await import(url);
    const name = `test-${crypto.randomUUID()}`;
    const first = createProjectStorage({ name }), second = createProjectStorage({ name });
    const saved = await first.save(input, new Blob(['original'], { type: 'image/png' }));
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'session') throw new DOMException('Full', 'QuotaExceededError');
      return originalPut.apply(this, args);
    };
    let failure;
    try { await first.save({ ...saved, name: 'Must roll back' }, undefined, 1); }
    catch (error) { failure = error.name; }
    finally { IDBObjectStore.prototype.put = originalPut; }
    const afterFailure = await first.get(input.id);
    const writes = await Promise.allSettled([
      first.save({ ...saved, name: 'First tab' }, undefined, 1),
      second.save({ ...saved, name: 'Second tab' }, undefined, 1)
    ]);
    const final = await first.get(input.id);
    first.close(); second.close();
    return { failure, afterFailure: afterFailure.project, statuses: writes.map(w => w.status),
      rejection: writes.find(w => w.status === 'rejected')?.reason.name,
      revision: final.project.revision, image: await final.image.text() };
  }, { url: storageURL, input: projectFixture() });
  expect(result.failure).toBe('QuotaExceededError');
  expect(result.afterFailure.name).toBe('Моя палитра');
  expect(result.afterFailure.revision).toBe(1);
  expect(result.statuses.sort()).toEqual(['fulfilled', 'rejected']);
  expect(result.rejection).toBe('ProjectConflictError');
  expect(result.revision).toBe(2);
  expect(result.image).toBe('original');
});
