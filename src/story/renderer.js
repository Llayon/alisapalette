/**
 * Story renderer: один движок для preview и PNG-экспорта.
 * Компоновка всегда в пространстве 1080×1920, масштаб — через transform.
 * renderStory(ctx, W, H, input) -> meta {swatches, texts} в координатах 1080×1920.
 * Цвета и проценты — только из фактической палитры, без изменений.
 */
import { TEMPLATES } from './templates.js';
import { getPoeticColorName } from '../poetic.js';
import { rgbToHex } from '../color-science.js';

export const EXPORT_W = 1080;
export const EXPORT_H = 1920;
export const FALLBACK_W = 720;
export const FALLBACK_H = 1280;

export function pickStoryColors(palette, count) {
  const sorted = [...(palette || [])].sort((a, b) => b.percentage - a.percentage);
  const n = Math.max(1, Math.min(count || 5, sorted.length));
  return sorted.slice(0, n).map((c) => ({
    r: c.r, g: c.g, b: c.b,
    hex: rgbToHex(c.r, c.g, c.b),
    name: getPoeticColorName(c.r, c.g, c.b),
    pct: c.percentage
  }));
}

export function renderStory(ctx, W, H, input) {
  const tpl = TEMPLATES[input.template] || TEMPLATES.editorial;
  const env = {
    W: EXPORT_W, H: EXPORT_H,
    photo: input.photo || null,
    colors: pickStoryColors(input.palette, input.count),
    title: input.title,
    channel: input.channel,
    showNames: input.showNames !== false,
    showHex: input.showHex !== false,
    showPct: input.showPct === true,
    fit: input.fit === 'contain' ? 'contain' : 'cover',
    cropX: input.cropX,
    cropY: input.cropY,
    olfactory: input.olfactory || null
  };
  const S = Math.min(W / EXPORT_W, H / EXPORT_H);
  ctx.save();
  ctx.setTransform(S, 0, 0, S, 0, 0);
  try {
    return tpl.render(ctx, env);
  } finally {
    ctx.restore();
  }
}
