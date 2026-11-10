import { it, expect, vi } from 'vitest';
import { createProjectStorage } from '../src/projects/storage.js';

it('releases a blocked open request if it eventually succeeds', async () => {
  const request = {};
  const storage = createProjectStorage({ indexedDB: { open: () => request } });
  const result = expect(storage.list()).rejects.toThrow('Close other tabs');
  request.onblocked();
  await result;
  const close = vi.fn(); request.result = { close };
  request.onsuccess();
  expect(close).toHaveBeenCalledOnce();
  storage.close();
  expect(close).toHaveBeenCalledOnce();
});

it('turns a denied indexedDB getter into a recoverable operation error', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, get() { throw new DOMException('Denied', 'SecurityError'); } });
  try {
    const storage = createProjectStorage();
    await expect(storage.list()).rejects.toMatchObject({ name: 'SecurityError' });
    await expect(storage.list()).rejects.toMatchObject({ name: 'SecurityError' });
  } finally {
    if (original) Object.defineProperty(globalThis, 'indexedDB', original);
    else delete globalThis.indexedDB;
  }
});
