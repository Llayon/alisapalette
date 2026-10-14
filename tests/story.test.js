import { describe, it, expect } from 'vitest';
import { coverRect, containRect, insideSafe, rowRects, SAFE, STORY_W, STORY_H } from '../src/story/layout.js';
import { wrapLines, fitFontSize } from '../src/story/typography.js';
import { pickStoryColors } from '../src/story/renderer.js';
import { defaultStoryState, storyKey, isValidChannel, touchStory, resetStoryForPhoto, state } from '../src/story/story-state.js';
import { templateIds } from '../src/story/templates.js';

function mockCtx(charW = 10) {
  const ctx = { font: '10px sans', measureText: (t) => ({ width: t.length * charW }) };
  return ctx;
}
// Мок с учётом кегля (для fitFontSize)
function mockCtxScaled() {
  const ctx = {
    font: '90px serif',
    measureText(t) {
      const m = /(\d+)px/.exec(this.font);
      const px = m ? parseInt(m[1], 10) : 10;
      return { width: (t.length * px) / 9 };
    }
  };
  return ctx;
}

describe('layout: cover/contain', () => {
  it('cover без пустых областей, focal работает', () => {
    // источник 800x600, рамка 936x640
    const c = coverRect(800, 600, 936, 640, 0.5, 0.5);
    expect(c.sw).toBeLessThanOrEqual(800);
    expect(c.sh).toBeLessThanOrEqual(600);
    expect(c.sx).toBeGreaterThanOrEqual(0);
    expect(c.sy).toBeGreaterThanOrEqual(0);
    expect(c.sx + c.sw).toBeLessThanOrEqual(800 + 1e-6);
    expect(c.sy + c.sh).toBeLessThanOrEqual(600 + 1e-6);
    // левый фокус сдвигает кроп влево
    const left = coverRect(800, 600, 936, 640, 0, 0.5);
    const right = coverRect(800, 600, 936, 640, 1, 0.5);
    expect(left.sx).toBeLessThanOrEqual(right.sx);
    expect(left.sx).toBe(0);
  });
  it('contain целиком внутри рамки', () => {
    const r = containRect(600, 800, 10, 20, 300, 400);
    expect(r.dw).toBeLessThanOrEqual(300);
    expect(r.dh).toBeLessThanOrEqual(400);
    expect(r.dx).toBeGreaterThanOrEqual(10);
  });
  it('safe-zone 9:16', () => {
    expect(STORY_W / STORY_H).toBeCloseTo(9 / 16, 5);
    expect(insideSafe(SAFE.left, SAFE.top, 100, 100)).toBe(true);
    expect(insideSafe(0, 0, 100, 100)).toBe(false);
    expect(insideSafe(SAFE.left, STORY_H - 100, 100, 100)).toBe(false);
  });
  it('rowRects без наложений', () => {
    const rows = rowRects(0, 0, 1000, 50, 5, 10);
    expect(rows.length).toBe(5);
    expect(rows[4].x + rows[4].w).toBeLessThanOrEqual(1000 + 1e-6);
  });
});

describe('typography: переносы без slice', () => {
  const ctx = mockCtx(10);
  it('короткий текст — одна строка', () => {
    expect(wrapLines(ctx, 'Палитра дня', 500, 2).lines).toEqual(['Палитра дня']);
  });
  it('длинный заголовок переносится по словам, не вылезая за ширину', () => {
    const { lines } = wrapLines(ctx, 'Цвета сегодняшнего образа и настроения', 150, 2);
    expect(lines.length).toBeLessThanOrEqual(2);
    for (const ln of lines) expect(ctx.measureText(ln).width).toBeLessThanOrEqual(150);
  });
  it('длинное русское слово режется посимвольно', () => {
    const { lines } = wrapLines(ctx, 'достопримечательность', 100, 3);
    expect(lines.length).toBeGreaterThan(1);
    for (const ln of lines) expect(ctx.measureText(ln).width).toBeLessThanOrEqual(100);
  });
  it('кириллица и пустой текст', () => {
    expect(wrapLines(ctx, '', 100, 2).lines).toEqual([]);
    expect(wrapLines(ctx, 'Мой осенний день', 500, 2).truncated).toBe(false);
  });
  it('fitFontSize уменьшает кегль до влезания', () => {
    const ctx = mockCtxScaled();
    const text = 'Очень длинный заголовок открытки';
    const size = fitFontSize(ctx, text, 200, 90, 30, 'serif');
    expect(size).toBeLessThan(90);
    expect(ctx.measureText(text).width).toBeLessThanOrEqual(200);
  });
});

describe('renderer: выбор цветов', () => {
  const pal = [
    { r: 10, g: 10, b: 10, percentage: 50 },
    { r: 20, g: 20, b: 20, percentage: 30 },
    { r: 30, g: 30, b: 30, percentage: 20 }
  ];
  it('берёт топ-N по доле, HEX точный', () => {
    const out = pickStoryColors(pal, 2);
    expect(out.length).toBe(2);
    expect(out[0].hex).toBe('#0A0A0A');
    expect(out[0].pct).toBe(50);
  });
  it('1–2 цвета: без выдуманных (ровно столько, сколько есть)', () => {
    expect(pickStoryColors([pal[0]], 6).length).toBe(1);
    expect(pickStoryColors([], 5).length).toBe(0);
  });
  it('4 шаблона зарегистрированы', () => {
    expect(templateIds().sort()).toEqual(['aroma', 'editorial', 'magazine', 'polaroid']);
  });
});

describe('story-state: инвалидация и брендинг', () => {
  it('ключ меняется при любом изменении', () => {
    const s = defaultStoryState();
    const k1 = storyKey(s, 'abc', 800, 600);
    expect(storyKey({ ...s, title: 'Другое' }, 'abc', 800, 600)).not.toBe(k1);
    expect(storyKey({ ...s, cropX: 0.2 }, 'abc', 800, 600)).not.toBe(k1);
    expect(storyKey(s, 'abd', 800, 600)).not.toBe(k1);
  });
  it('канал: только валидный @handle; подпись только при заданном значении', () => {
    expect(isValidChannel('@my_lifestyle_blog')).toBe(true); // формат ок, но default channel — ''
    expect(defaultStoryState().channel).toBe('');
    expect(isValidChannel('@blog123')).toBe(true);
    expect(isValidChannel('')).toBe(false);
    expect(isValidChannel('@ab')).toBe(false);
    expect(isValidChannel('канал')).toBe(false);
  });
  it('новое фото сбрасывает crop', () => {
    state.cropX = 0.1; state.cropY = 0.9;
    const v = state.version;
    resetStoryForPhoto();
    expect(state.cropX).toBe(0.5);
    expect(state.version).toBeGreaterThan(v);
    expect(state.cache.ready).toBe(false);
    touchStory();
  });
});
