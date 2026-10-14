import { describe, it, expect } from 'vitest';
import { stratifiedSample } from '../src/sampling.js';
import { analyzePixels, resetIdCounter } from '../src/palette.js';
import { rgbToOklab } from '../src/color-science.js';

/** Синтетический ImageData: верх — цвет A, низ — цвет B. */
function halfImage(w, h, top, bottom) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = y < h / 2 ? top : bottom;
      const i = (y * w + x) * 4;
      data[i] = c.r; data[i + 1] = c.g; data[i + 2] = c.b; data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

const MILK = { r: 245, g: 245, b: 244 };
const DENIM = { r: 74, g: 112, b: 152 };
const WINE = { r: 98, g: 22, b: 38 };

describe('стратифицированная выборка без пространственного смещения', () => {
  it('низ кадра покрыт: max y выборки > 0.85', () => {
    const s = stratifiedSample(halfImage(400, 300, MILK, DENIM), { target: 9000 });
    const maxY = Math.max(...s.map((p) => p.y));
    expect(maxY).toBeGreaterThan(0.85);
  });
  it('доли верха/низа ~50/50 (±6)', () => {
    const s = stratifiedSample(halfImage(400, 300, MILK, DENIM), { target: 9000 });
    const bottom = s.filter((p) => p.y >= 0.5).length / s.length;
    expect(bottom).toBeGreaterThan(0.44);
    expect(bottom).toBeLessThan(0.56);
  });
  it('детерминирована', () => {
    const a = stratifiedSample(halfImage(400, 300, MILK, DENIM), { target: 9000 });
    const b = stratifiedSample(halfImage(400, 300, MILK, DENIM), { target: 9000 });
    expect(a.length).toBe(b.length);
    expect(a[100]).toEqual(b[100]);
  });
  it('прозрачные пиксели (alpha<128) исключаются из выборки', () => {
    const w = 200, h = 100;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const transparent = x < w / 2;
        data[i] = DENIM.r; data[i + 1] = DENIM.g; data[i + 2] = DENIM.b;
        data[i + 3] = transparent ? 0 : 255;
      }
    }
    const s = stratifiedSample({ width: w, height: h, data }, { target: 9000 });
    expect(s.length).toBeGreaterThan(100);
    // Все точки — из непрозрачной половины
    expect(Math.min(...s.map((p) => p.x))).toBeGreaterThanOrEqual(0.49);
  });
});

describe('инвариантность долей к расположению областей (аудит 1b)', () => {
  const MILK = { r: 245, g: 245, b: 244 };
  const DENIM = { r: 74, g: 112, b: 152 };
  const WINE = { r: 98, g: 22, b: 38 };
  function img400(fn) {
    const w = 400, h = 300;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = fn(x / w, y / h);
      const i = (y * w + x) * 4;
      data[i] = c.r; data[i + 1] = c.g; data[i + 2] = c.b; data[i + 3] = 255;
    }
    return { width: w, height: h, data };
  }
  function shares719(fn) {
    resetIdCounter();
    const items = analyzePixels(stratifiedSample(img400(fn), { target: 9000 }), { algorithm: 'photo', colorCount: 6, minDelta: 28 });
    const get = (pred) => { const f = items.find(pred); return f ? f.percentage : -1; };
    return {
      milk: get((c) => c.r > 200),
      denim: get((c) => c.b - c.r > 40),
      wine: get((c) => c.r > 80 && c.r - c.g > 30),
      n: items.length,
      sum: items.reduce((s, c) => s + c.percentage, 0)
    };
  }
  const layouts = {
    hStripes: (x, y) => (y < 0.7 ? MILK : y < 0.9 ? DENIM : WINE),
    vStripes: (x, y) => (x < 0.7 ? MILK : x < 0.9 ? DENIM : WINE),
    scattered: (x, y) => { const h = Math.abs(Math.sin(x * 91.7 + y * 47.3) * 43758.5) % 1; return h < 0.7 ? MILK : h < 0.9 ? DENIM : WINE; },
  };
  for (const [name, fn] of Object.entries(layouts)) {
    it(`${name}: доли 70/20/10 с точностью ±1.5`, () => {
      const s = shares719(fn);
      expect(s.n).toBe(3);
      expect(Math.abs(s.milk - 70)).toBeLessThan(1.5);
      expect(Math.abs(s.denim - 20)).toBeLessThan(1.5);
      expect(Math.abs(s.wine - 10)).toBeLessThan(1.5);
      expect(Math.abs(s.sum - 100)).toBeLessThan(0.06);
    });
  }
  it('угол+край: доли соответствуют площадям, а не позиции', () => {
    // milk 72 / denim 20 (y 0.72..0.92) / wine 8 (y>0.92)
    const s = shares719((x, y) => (y > 0.92 ? WINE : y > 0.72 ? DENIM : MILK));
    expect(Math.abs(s.milk - 72)).toBeLessThan(2);
    expect(Math.abs(s.denim - 20)).toBeLessThan(2);
    expect(Math.abs(s.wine - 8)).toBeLessThan(2);
  });
  it('нижняя половина 50% денима находится (было 2.4% из-за смещения выборки)', () => {
    resetIdCounter();
    const s = stratifiedSample(halfImage(400, 300, MILK, DENIM), { target: 9000 });
    const items = analyzePixels(s, { algorithm: 'photo', colorCount: 6, minDelta: 28 });
    const den = items.find((c) => c.b - c.r > 40);
    expect(den).toBeDefined();
    expect(den.percentage).toBeGreaterThan(40);
    expect(den.percentage).toBeLessThan(60);
  });
  it('нижняя полоса-акцент 10% бордо находится', () => {
    resetIdCounter();
    const w = 400, h = 300;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = y < h * 0.9 ? MILK : WINE;
        const i = (y * w + x) * 4;
        data[i] = c.r; data[i + 1] = c.g; data[i + 2] = c.b; data[i + 3] = 255;
      }
    }
    const px = [];
    const img = { width: w, height: h, data };
    for (const p of stratifiedSample(img, { target: 9000 })) px.push(p);
    const items = analyzePixels(px, { algorithm: 'photo', colorCount: 6, minDelta: 28 });
    const wine = items.find((c) => c.r > 80 && c.r - c.g > 30);
    expect(wine).toBeDefined();
    expect(wine.percentage).toBeGreaterThan(5);
    expect(wine.role).toBe('accent');
  });
});
