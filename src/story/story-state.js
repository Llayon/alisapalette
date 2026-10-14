/**
 * Состояние Story Studio. Только безопасные настройки (без данных изображения).
 * Кэш Blob инвалидируется версионированием: устаревшая открытка не отправится.
 */
import { STORY_W, STORY_H } from './layout.js';

export const APP_URL = 'https://llayon.github.io/alisapalette/';

const STORAGE_KEY = 'chromastyle.story.v1';

export function defaultStoryState() {
  return {
    template: 'editorial', // editorial | polaroid | magazine | aroma
    title: 'Палитра моего дня',
    channel: '', // опционально, только валидный @handle
    count: 5, // оттенков 3..6
    showNames: true,
    showHex: true,
    showPct: false,
    fit: 'cover', // cover | contain
    cropX: 0.5,
    cropY: 0.42,
    photoId: 0, // инкремент при новом фото — сбрасывает crop
    version: 0, // инкремент при любом изменении — инвалидирует кэш
    cache: { key: '', blob: null, url: '', ready: false, W: 0, H: 0 }
  };
}

export const state = defaultStoryState();

export function storyKey(s, paletteSig, photoW, photoH) {
  return JSON.stringify([
    s.template, s.title, s.channel, s.count,
    s.showNames, s.showHex, s.showPct, s.fit,
    s.cropX.toFixed(3), s.cropY.toFixed(3),
    s.photoId, photoW, photoH, paletteSig, STORY_W, STORY_H
  ]);
}

/** Любое изменение настроек: version++ и сброс готовности кэша. */
export function touchStory() {
  state.version++;
  state.cache.ready = false;
  if (state.cache.url) {
    try { URL.revokeObjectURL(state.cache.url); } catch { /* noop */ }
    state.cache.url = '';
  }
  state.cache.blob = null;
  persistStory();
}

/** Новое фото: сброс crop/кэша, версия++. */
export function resetStoryForPhoto() {
  state.photoId++;
  state.cropX = 0.5;
  state.cropY = 0.42;
  touchStory();
}

export function isValidChannel(v) {
  return /^@[A-Za-z0-9_]{5,32}$/.test(String(v || '').trim());
}

export function persistStory() {
  try {
    const { template, count, showNames, showHex, showPct, fit } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ template, count, showNames, showHex, showPct, fit }));
  } catch { /* приватный режим — молча */ }
}

export function restoreStory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    if (o && typeof o === 'object') {
      if (['editorial', 'polaroid', 'magazine', 'aroma'].includes(o.template)) state.template = o.template;
      if (o.count >= 3 && o.count <= 6) state.count = o.count;
      for (const k of ['showNames', 'showHex', 'showPct']) if (typeof o[k] === 'boolean') state[k] = o[k];
      if (['cover', 'contain'].includes(o.fit)) state.fit = o.fit;
    }
  } catch { /* noop */ }
}
