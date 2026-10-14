import { describe, it, expect, beforeEach } from 'vitest';
import { analyzePixels, recalculateShares, sortPaletteItems, resetIdCounter, minDeltaToOklab } from '../src/palette.js';
import { rgbToOklab, oklabDistance } from '../src/color-science.js';
import {
  solidPixels, splitPixels, threeWayPixels, fourRegionsPixels, gradientPixels,
  closeBeigePixels, beigeWithRedAccent, noisyPixels, singleNoisePixel,
  manyDetailsPixels, sumShares
} from './fixtures.js';

beforeEach(() => resetIdCounter());

function checkSums(items) {
  const s = sumShares(items);
  expect(Math.abs(s - 100)).toBeLessThan(0.06);
}

describe('однотонные изображения', () => {
  it('белое: 1 цвет, 100%, без дубликатов', () => {
    const items = analyzePixels(solidPixels({ r: 255, g: 255, b: 255 }), { algorithm: 'photo', colorCount: 8, minDelta: 28 });
    expect(items.length).toBe(1);
    expect(items[0].percentage).toBeCloseTo(100, 0);
    checkSums(items);
  });
  it('чёрное: 1 цвет, 100%', () => {
    const items = analyzePixels(solidPixels({ r: 0, g: 0, b: 0 }), { algorithm: 'photo', colorCount: 6, minDelta: 28 });
    expect(items.length).toBe(1);
    expect(items[0].percentage).toBeCloseTo(100, 0);
  });
  it('серое: 1 цвет', () => {
    const items = analyzePixels(solidPixels({ r: 128, g: 128, b: 128 }), { algorithm: 'photo', colorCount: 6, minDelta: 28 });
    expect(items.length).toBe(1);
    checkSums(items);
  });
  it('один однородный RGB-цвет: репрезентативный ≈ исходнику', () => {
    const src = { r: 74, g: 112, b: 152 };
    const items = analyzePixels(solidPixels(src), { algorithm: 'photo', colorCount: 6, minDelta: 28 });
    expect(items.length).toBe(1);
    const d = oklabDistance(rgbToOklab(src), rgbToOklab(items[0]));
    expect(d).toBeLessThan(0.02);
  });
});

describe('доли', () => {
  it('50/50: два цвета ~50/50', () => {
    const items = analyzePixels(splitPixels({ r: 200, g: 40, b: 40 }, { r: 40, g: 80, b: 200 }, 0.5), { algorithm: 'photo', colorCount: 6, minDelta: 28 });
    expect(items.length).toBe(2);
    expect(items[0].percentage).toBeGreaterThan(44);
    expect(items[0].percentage).toBeLessThan(56);
    expect(items[1].percentage).toBeGreaterThan(44);
    checkSums(items);
  });
  it('60/30/10: три цвета в допусках', () => {
    const items = analyzePixels(
      threeWayPixels([{ r: 220, g: 210, b: 190 }, { r: 70, g: 110, b: 150 }, { r: 150, g: 30, b: 40 }], [0.6, 0.3, 0.1]),
      { algorithm: 'photo', colorCount: 6, minDelta: 28 }
    );
    expect(items.length).toBe(3);
    const pcts = items.map((i) => i.percentage).sort((a, b) => b - a);
    expect(pcts[0]).toBeGreaterThan(52); expect(pcts[0]).toBeLessThan(68);
    expect(pcts[1]).toBeGreaterThan(23); expect(pcts[1]).toBeLessThan(37);
    expect(pcts[2]).toBeGreaterThan(5); expect(pcts[2]).toBeLessThan(16);
    checkSums(items);
  });
  it('четыре области: 4 цвета', () => {
    const items = analyzePixels(fourRegionsPixels(), { algorithm: 'photo', colorCount: 6, minDelta: 28 });
    expect(items.length).toBe(4);
    checkSums(items);
  });
});

describe('устойчивость', () => {
  it('стабильность: два запуска идентичны', () => {
    const px = beigeWithRedAccent();
    const a = analyzePixels(px, { algorithm: 'photo', colorCount: 6, minDelta: 28 });
    const b = analyzePixels(px, { algorithm: 'photo', colorCount: 6, minDelta: 28 });
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].r).toBe(b[i].r);
      expect(a[i].g).toBe(b[i].g);
      expect(a[i].b).toBe(b[i].b);
      expect(a[i].percentage).toBe(b[i].percentage);
    }
  });
  it('градиент: не взрывается количеством, сумма 100', () => {
    const items = analyzePixels(gradientPixels(), { algorithm: 'photo', colorCount: 6, minDelta: 28 });
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.length).toBeLessThanOrEqual(6);
    checkSums(items);
  });
  it('близкие бежевые: нет неоправданных дубликатов', () => {
    const items = analyzePixels(closeBeigePixels(), { algorithm: 'photo', colorCount: 8, minDelta: 28 });
    expect(items.length).toBeLessThanOrEqual(3);
    checkSums(items);
  });
  it('почти нейтральная палитра: мало цветов', () => {
    const items = analyzePixels(closeBeigePixels(2000), { algorithm: 'photo', colorCount: 6, minDelta: 28 });
    expect(items.length).toBeLessThanOrEqual(3);
  });
  it('красный акцент на бежевом сохраняется', () => {
    const items = analyzePixels(beigeWithRedAccent(), { algorithm: 'photo', colorCount: 6, minDelta: 28 });
    const hasRed = items.some((c) => c.r > 150 && c.g < 80 && c.b < 80);
    expect(hasRed).toBe(true);
    const red = items.find((c) => c.r > 150 && c.g < 80 && c.b < 80);
    expect(red.role).toBe('accent');
    checkSums(items);
  });
  it('JPEG-шум не плодит цвета', () => {
    const items = analyzePixels(noisyPixels(), { algorithm: 'photo', colorCount: 6, minDelta: 28 });
    expect(items.length).toBeLessThanOrEqual(3);
    checkSums(items);
  });
  it('одиночный шумовой пиксель не становится акцентом', () => {
    const items = analyzePixels(singleNoisePixel(), { algorithm: 'photo', colorCount: 6, minDelta: 28 });
    const neon = items.filter((c) => c.r > 200 && c.g < 60 && c.b > 150);
    expect(neon.length).toBe(0);
    expect(items.length).toBe(1);
  });
  it('много мелких деталей: разумное число цветов', () => {
    const items = analyzePixels(manyDetailsPixels(), { algorithm: 'photo', colorCount: 8, minDelta: 28 });
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items.length).toBeLessThanOrEqual(8);
    checkSums(items);
  });
  it('если различимых цветов 2, а просят 8 — возвращаем 2, не выдумываем', () => {
    const items = analyzePixels(splitPixels({ r: 200, g: 40, b: 40 }, { r: 40, g: 80, b: 200 }, 0.5), { algorithm: 'photo', colorCount: 8, minDelta: 28 });
    expect(items.length).toBe(2);
  });
});

describe('режимы', () => {
  it('mediancut и histogram работают и дают 100%', () => {
    const px = threeWayPixels([{ r: 220, g: 210, b: 190 }, { r: 70, g: 110, b: 150 }, { r: 150, g: 30, b: 40 }], [0.6, 0.3, 0.1]);
    for (const algo of ['mediancut', 'histogram', 'kmeans']) {
      const items = analyzePixels(px, { algorithm: algo, colorCount: 6, minDelta: 28 });
      expect(items.length).toBeGreaterThanOrEqual(1);
      checkSums(items);
    }
  });
});

describe('recalculateShares', () => {
  it('после удаления/добавления сумма снова 100', () => {
    const px = threeWayPixels([{ r: 220, g: 210, b: 190 }, { r: 70, g: 110, b: 150 }, { r: 150, g: 30, b: 40 }], [0.6, 0.3, 0.1]);
    const items = analyzePixels(px, { algorithm: 'photo', colorCount: 6, minDelta: 28 });
    items.pop();
    recalculateShares(items, px);
    checkSums(items);
  });
});

describe('сортировки', () => {
  it('luminance/hue не теряют элементы', () => {
    const items = analyzePixels(manyDetailsPixels(), { algorithm: 'photo', colorCount: 6, minDelta: 28 });
    for (const sort of ['dominance', 'luminance', 'hue']) {
      const s = sortPaletteItems(items, sort);
      expect(s.length).toBe(items.length);
      checkSums(s);
    }
  });
});

describe('minDelta mapping', () => {
  it('монотонность порога', () => {
    expect(minDeltaToOklab(10)).toBeLessThan(minDeltaToOklab(28));
    expect(minDeltaToOklab(28)).toBeLessThan(minDeltaToOklab(70));
  });
});
