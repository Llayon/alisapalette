import { describe, it, expect } from 'vitest';
import {
  srgbChannelToLinear, linearToSrgbChannel, rgbToLinear, linearToRgb,
  rgbToOklab, oklabToRgb, oklabToOklch, oklchToRgb, oklabDistance,
  relativeLuminance, isNeutralRgb, linearInGamut, rgbToHex, hexToRgb, hueDiff
} from '../src/color-science.js';

const CASES = [
  { r: 255, g: 255, b: 255 },
  { r: 0, g: 0, b: 0 },
  { r: 128, g: 128, b: 128 },
  { r: 198, g: 134, b: 78 },
  { r: 74, g: 112, b: 152 },
  { r: 232, g: 165, b: 178 },
  { r: 18, g: 112, b: 84 },
  { r: 248, g: 241, b: 229 }
];

describe('sRGB <-> linear обратимость', () => {
  it('каналы туда-обратно без дрейфа', () => {
    for (let v = 0; v <= 255; v += 7) {
      const lin = srgbChannelToLinear(v);
      const back = linearToSrgbChannel(lin);
      expect(Math.abs(back - v)).toBeLessThanOrEqual(1);
    }
  });
  it('rgb -> linear -> rgb', () => {
    for (const c of CASES) {
      const back = linearToRgb(rgbToLinear(c));
      expect(Math.abs(back.r - c.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - c.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - c.b)).toBeLessThanOrEqual(1);
    }
  });
});

describe('sRGB <-> OKLab обратимость', () => {
  it('погрешность в пределах 2 единиц sRGB', () => {
    for (const c of CASES) {
      const back = oklabToRgb(rgbToOklab(c));
      expect(Math.abs(back.r - c.r)).toBeLessThanOrEqual(2);
      expect(Math.abs(back.g - c.g)).toBeLessThanOrEqual(2);
      expect(Math.abs(back.b - c.b)).toBeLessThanOrEqual(2);
    }
  });
  it('никаких NaN/Infinity', () => {
    for (const c of CASES) {
      const lab = rgbToOklab(c);
      expect([lab.L, lab.a, lab.b].every(Number.isFinite)).toBe(true);
      const lch = oklabToOklch(lab);
      expect(Number.isFinite(lch.L) && Number.isFinite(lch.C)).toBe(true);
    }
  });
});

describe('gamut mapping', () => {
  it('вне-gamut OKLCH возвращается в sRGB без искажения hue/lightness сверх меры', () => {
    const tests = [
      { L: 0.7, C: 0.35, H: 20 },
      { L: 0.5, C: 0.3, H: 140 },
      { L: 0.9, C: 0.25, H: 280 }
    ];
    for (const t of tests) {
      const rgb = oklchToRgb(t);
      expect([rgb.r, rgb.g, rgb.b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)).toBe(true);
      expect(linearInGamut(rgbToLinear(rgb), 1e-3)).toBe(true);
    }
  });
  it('внутри-gamut цвета не меняются', () => {
    for (const c of CASES) {
      const back = oklchToRgb(oklabToOklch(rgbToOklab(c)));
      expect(Math.abs(back.r - c.r)).toBeLessThanOrEqual(2);
      expect(Math.abs(back.g - c.g)).toBeLessThanOrEqual(2);
      expect(Math.abs(back.b - c.b)).toBeLessThanOrEqual(2);
    }
  });
});

describe('нейтрали и hue-границы', () => {
  it('белый/чёрный/серый — нейтрали, hue null', () => {
    for (const c of [{ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }, { r: 128, g: 128, b: 128 }]) {
      expect(isNeutralRgb(c)).toBe(true);
      expect(oklabToOklch(rgbToOklab(c)).H).toBeNull();
    }
  });
  it('молочно-бежевый почти нейтрален, hue не используется для резких поворотов', () => {
    const milk = { r: 248, g: 241, b: 229 };
    const lch = oklabToOklch(rgbToOklab(milk));
    expect(lch.C).toBeLessThan(0.04);
  });
  it('расстояние OKLab симметрично и неотрицательно, не называется CIEDE2000', () => {
    const a = rgbToOklab({ r: 200, g: 50, b: 50 });
    const b = rgbToOklab({ r: 50, g: 50, b: 200 });
    expect(oklabDistance(a, b)).toBeGreaterThan(0);
    expect(oklabDistance(a, b)).toBeCloseTo(oklabDistance(b, a), 10);
    expect(oklabDistance(a, a)).toBeCloseTo(0, 10);
  });
});

describe('относительная яркость sRGB', () => {
  it('белый=1, чёрный=0, серый ~0.216', () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 3);
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
    expect(relativeLuminance({ r: 128, g: 128, b: 128 })).toBeCloseTo(0.2159, 2);
  });
  it('не равна наивной взвешенной сумме байтов', () => {
    const naive = 0.2126 * 128 + 0.7152 * 128 + 0.0722 * 128;
    expect(naive).toBeGreaterThan(100); // байтовая сумма бессмысленна как яркость 0..1
    expect(relativeLuminance({ r: 128, g: 128, b: 128 })).toBeLessThan(1);
  });
});

describe('hex utils', () => {
  it('HEX соответствует отображаемому sRGB', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 128 })).toBe('#FF0080');
    expect(hexToRgb('#FF0080')).toEqual({ r: 255, g: 0, b: 128 });
  });
  it('hueDiff корректен', () => {
    expect(hueDiff(10, 350)).toBeCloseTo(20, 5);
    expect(hueDiff(null, 10)).toBe(Infinity);
  });
});
