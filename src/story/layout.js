/**
 * Story layout: чистая геометрия 9:16. Без DOM, тестируемо.
 */
export const STORY_W = 1080;
export const STORY_H = 1920;

// Консервативная safe-zone (эвристика под перекрытия TG/IG Stories,
// не претендует на точность для всех версий приложений).
export const SAFE = { top: 210, bottom: 340, left: 64, right: 64 };

export function clamp01(v) {
  if (!Number.isFinite(v)) return 0.5;
  return Math.min(1, Math.max(0, v));
}

/**
 * Cover: источник покрывает рамку целиком.
 * focalX/focalY (0..1) — точка интереса, остаётся видимой.
 * Возвращает {sx,sy,sw,sh} в координатах источника. Пустых областей нет.
 */
export function coverRect(srcW, srcH, boxW, boxH, focalX = 0.5, focalY = 0.5) {
  if (!srcW || !srcH || !boxW || !boxH) return { sx: 0, sy: 0, sw: srcW || 1, sh: srcH || 1 };
  const fx = clamp01(focalX), fy = clamp01(focalY);
  const scale = Math.max(boxW / srcW, boxH / srcH);
  const sw = boxW / scale;
  const sh = boxH / scale;
  // Позиция кропа: focal определяет, какая часть источника видна.
  let sx = fx * srcW - (fx * boxW) / scale;
  let sy = fy * srcH - (fy * boxH) / scale;
  sx = Math.min(Math.max(0, sx), Math.max(0, srcW - sw));
  sy = Math.min(Math.max(0, sy), Math.max(0, srcH - sh));
  return { sx, sy, sw: Math.min(sw, srcW), sh: Math.min(sh, srcH) };
}

/**
 * Contain: источник целиком внутри рамки. Возвращает dest-rect внутри рамки.
 */
export function containRect(srcW, srcH, boxX, boxY, boxW, boxH) {
  if (!srcW || !srcH) return { dx: boxX, dy: boxY, dw: boxW, dh: boxH };
  const scale = Math.min(boxW / srcW, boxH / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  return { dx: boxX + (boxW - dw) / 2, dy: boxY + (boxH - dh) / 2, dw, dh };
}

/** Проверка: rect целиком внутри safe-зоны истории. */
export function insideSafe(x, y, w, h, W = STORY_W, H = STORY_H, safe = SAFE) {
  return x >= safe.left && y >= safe.top && x + w <= W - safe.right && y + h <= H - safe.bottom;
}

/** Равномерный ряд прямоугольников по горизонтали. */
export function rowRects(x, y, w, h, n, gap) {
  const out = [];
  if (n <= 0) return out;
  const cw = (w - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) out.push({ x: x + i * (cw + gap), y, w: cw, h });
  return out;
}
