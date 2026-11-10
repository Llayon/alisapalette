import { describe, it, expect, vi } from 'vitest';
import { createPhotoLoader } from '../src/photo-loader.js';

function setup() {
  const pending = new Map();
  const commit = vi.fn(), onError = vi.fn();
  const loader = createPhotoLoader({
    decode: file => new Promise((resolve, reject) => pending.set(file, { resolve, reject })),
    commit, onError
  });
  return { loader, pending, commit, onError };
}

describe('photo loading order', () => {
  it('keeps the bitmap alive during an async commit and invalidates superseded commits', async () => {
    let release, entered;
    const started = new Promise(resolve => { entered = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const image = { close: vi.fn() }, applied = vi.fn();
    const loader = createPhotoLoader({ decode: async () => image,
      commit: async (source, file, ms, isCurrent) => {
        entered(); await gate;
        if (isCurrent()) applied();
      }, onError: vi.fn() });
    const work = loader.load('first'); await started;
    expect(image.close).not.toHaveBeenCalled();
    loader.invalidate(); release(); await work;
    expect(applied).not.toHaveBeenCalled();
    expect(image.close).toHaveBeenCalledOnce();
  });
  it('only commits the last selection and closes both bitmaps', async () => {
    const { loader, pending, commit } = setup();
    const first = loader.load('first'), second = loader.load('second');
    const a = { close: vi.fn() }, b = { close: vi.fn() };
    pending.get('second').resolve(b); await second;
    pending.get('first').resolve(a); await first;
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0].slice(0, 2)).toEqual([b, 'second']);
    expect(a.close).toHaveBeenCalledOnce(); expect(b.close).toHaveBeenCalledOnce();
  });
  it('a preset invalidates a pending file', async () => {
    const { loader, pending, commit } = setup();
    const work = loader.load('file'); loader.invalidate();
    const image = { close: vi.fn() }; pending.get('file').resolve(image); await work;
    expect(commit).not.toHaveBeenCalled(); expect(image.close).toHaveBeenCalledOnce();
  });
  it('does not report stale decoding failures', async () => {
    const { loader, pending, onError } = setup();
    const work = loader.load('file'); loader.invalidate();
    pending.get('file').reject(new Error('old')); await work;
    expect(onError).not.toHaveBeenCalled();
  });
  it('reports the current failure', async () => {
    const { loader, pending, onError, commit } = setup();
    const work = loader.load('file'); const error = new Error('invalid');
    pending.get('file').reject(error); await work;
    expect(onError).toHaveBeenCalledWith(error); expect(commit).not.toHaveBeenCalled();
  });
  it('closes a bitmap when preparing the new photo fails', async () => {
    const image = { close: vi.fn() }, onError = vi.fn();
    const loader = createPhotoLoader({ decode: async () => image,
      commit: () => { throw new Error('canvas'); }, onError });
    await loader.load('file');
    expect(image.close).toHaveBeenCalledOnce(); expect(onError).toHaveBeenCalledOnce();
  });
});
