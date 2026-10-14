import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shareFile, canShareFile, shareSupport } from '../src/story/share.js';

function setNav(nav) {
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
}
beforeEach(() => {
  setNav({});
});

describe('share capability detection', () => {
  it('без API: unsupported, без исключений', async () => {
    expect(shareSupport().hasShare).toBe(false);
    expect(canShareFile({})).toBe(false);
    expect(await shareFile({})).toEqual({ status: 'unsupported' });
  });
  it('canShare=false для файлов: unsupported', async () => {
    const file = new Blob(['x'], { type: 'image/png' });
    setNav({ share: vi.fn(), canShare: () => false });
    expect(canShareFile(file)).toBe(false);
    expect(await shareFile(file)).toEqual({ status: 'unsupported' });
  });
});

describe('share cancellation handling', () => {
  it('AbortError — отмена, не ошибка, без fallback', async () => {
    const file = new Blob(['x'], { type: 'image/png' });
    const err = new DOMException('aborted', 'AbortError');
    setNav({ share: vi.fn().mockRejectedValue(err), canShare: () => true });
    const res = await shareFile(file, { title: 't' });
    expect(res).toEqual({ status: 'cancelled' });
  });
  it('успешная отправка — shared (mock: проверка приложения, не системы)', async () => {
    const file = new Blob(['x'], { type: 'image/png' });
    const share = vi.fn().mockResolvedValue(undefined);
    setNav({ share, canShare: () => true });
    expect(await shareFile(file, { title: 'ChromaStyle' })).toEqual({ status: 'shared' });
    expect(share).toHaveBeenCalledOnce();
  });
  it('NotAllowedError — error с именем, отдельным статусом от отмены', async () => {
    const file = new Blob(['x'], { type: 'image/png' });
    setNav({ share: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')), canShare: () => true });
    const res = await shareFile(file);
    expect(res.status).toBe('error');
    expect(res.error).toBe('NotAllowedError');
  });
});
