/**
 * PNG-экспорт: рендер 1080×1920 с fallback 720×1280, Blob с версионированием.
 * Никакой отправки на сервер — только локальный canvas.toBlob.
 */
import { renderStory, EXPORT_W, EXPORT_H, FALLBACK_W, FALLBACK_H } from './renderer.js';
import { SERIF, SANS, MONO } from './templates.js';

export async function ensureStoryFonts() {
  try {
    await Promise.all([
      document.fonts.load('700 90px "Cormorant Garamond"', 'Палитра'),
      document.fonts.load('600 34px Inter', 'Палитра'),
      document.fonts.load('700 34px "JetBrains Mono"', '#FF0080')
    ]);
    await document.fonts.ready;
  } catch { /* fallback-шрифты */ }
}

function makeCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
}

function toBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('empty-blob'))), 'image/png');
    } catch (e) {
      reject(e instanceof Error ? e : new Error('toblob-failed'));
    }
  });
}

/**
 * Рендерит открытку и возвращает {blob, W, H, meta, fallback}.
 * При нехватке памяти/лимитах Canvas — повтор 720×1280 (fallback:true).
 */
export async function renderStoryToBlob(input) {
  await ensureStoryFonts();
  const attempts = [
    { W: EXPORT_W, H: EXPORT_H, fallback: false },
    { W: FALLBACK_W, H: FALLBACK_H, fallback: true }
  ];
  let lastErr = null;
  for (const a of attempts) {
    try {
      const cv = makeCanvas(a.W, a.H);
      const ctx = cv.getContext('2d');
      if (!ctx) throw new Error('no-2d-context');
      const meta = renderStory(ctx, a.W, a.H, input);
      // Пустой результат — тоже ошибка, а не файл
      const probe = ctx.getImageData(0, 0, Math.min(8, a.W), Math.min(8, a.H)).data;
      void probe;
      const blob = await toBlob(cv);
      if (!blob.size) throw new Error('empty-blob');
      return { blob, W: a.W, H: a.H, meta, fallback: a.fallback };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error('render-failed');
    }
  }
  throw lastErr;
}

export function storyFileName(template, W, H) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `chromastyle-${template}-${W}x${H}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.png`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  }
}

export { SERIF, SANS, MONO };
