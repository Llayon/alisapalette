/** Синтетические фикстуры: пиксели как {r,g,b,x,y} — без Canvas, детерминированно. */
import { rgbToOklab } from '../src/color-science.js';

export function withLab(p) {
  return { ...p, lab: rgbToOklab(p) };
}

export function solidPixels(rgb, n = 2000) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(withLab({ r: rgb.r, g: rgb.g, b: rgb.b, x: (i % 50) / 50, y: Math.floor(i / 50) / 40 }));
  }
  return out;
}

export function splitPixels(rgbA, rgbB, ratioA = 0.5, n = 2000) {
  const out = [];
  const nA = Math.round(n * ratioA);
  for (let i = 0; i < n; i++) {
    const c = i < nA ? rgbA : rgbB;
    out.push(withLab({ r: c.r, g: c.g, b: c.b, x: (i % 50) / 50, y: Math.floor(i / 50) / 40 }));
  }
  return out;
}

export function threeWayPixels(colors, ratios, n = 3000) {
  const out = [];
  const bounds = [];
  let acc = 0;
  for (const r of ratios) { acc += r; bounds.push(acc); }
  for (let i = 0; i < n; i++) {
    const t = i / n;
    let k = 0;
    while (k < bounds.length - 1 && t >= bounds[k]) k++;
    const c = colors[k];
    out.push(withLab({ r: c.r, g: c.g, b: c.b, x: (i % 60) / 60, y: Math.floor(i / 60) / 50 }));
  }
  return out;
}

export function fourRegionsPixels(n = 2000) {
  const colors = [
    { r: 200, g: 60, b: 60 },
    { r: 60, g: 160, b: 80 },
    { r: 60, g: 110, b: 200 },
    { r: 230, g: 210, b: 120 }
  ];
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = colors[i % 4];
    out.push(withLab({ r: c.r, g: c.g, b: c.b, x: (i % 50) / 50, y: Math.floor(i / 50) / 40 }));
  }
  return out;
}

export function gradientPixels(n = 2000) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    out.push(withLab({ r: Math.round(40 + 180 * t), g: Math.round(80 + 60 * t), b: Math.round(200 - 120 * t), x: t, y: 0.5 }));
  }
  return out;
}

export function closeBeigePixels(n = 2000) {
  const beiges = [
    { r: 216, g: 198, b: 180 },
    { r: 220, g: 200, b: 182 },
    { r: 212, g: 195, b: 178 },
    { r: 218, g: 201, b: 184 }
  ];
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = beiges[i % beiges.length];
    out.push(withLab({ r: c.r, g: c.g, b: c.b, x: (i % 50) / 50, y: 0.5 }));
  }
  return out;
}

export function beigeWithRedAccent(n = 3000, accentShare = 0.04) {
  const out = [];
  const nA = Math.round(n * accentShare);
  for (let i = 0; i < n; i++) {
    const c = i < nA ? { r: 190, g: 30, b: 40 } : { r: 225, g: 210, b: 190 };
    out.push(withLab({ r: c.r, g: c.g, b: c.b, x: (i % 60) / 60, y: Math.floor(i / 60) / 50 }));
  }
  return out;
}

/** JPEG-подобный шум: база + детерминированный псевдошум ±12. */
export function noisyPixels(base = { r: 150, g: 140, b: 130 }, n = 2000) {
  const out = [];
  let seed = 1234567;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < n; i++) {
    const j = () => Math.round((rnd() - 0.5) * 24);
    out.push(withLab({
      r: Math.max(0, Math.min(255, base.r + j())),
      g: Math.max(0, Math.min(255, base.g + j())),
      b: Math.max(0, Math.min(255, base.b + j())),
      x: (i % 50) / 50, y: 0.5
    }));
  }
  return out;
}

/** Один шумовой пиксель на однородном фоне — не должен стать акцентом. */
export function singleNoisePixel(n = 2000) {
  const out = solidPixels({ r: 220, g: 210, b: 195 }, n);
  out[0] = withLab({ r: 255, g: 0, b: 200, x: 0.01, y: 0.01 });
  return out;
}

export function manyDetailsPixels(n = 4000) {
  const colors = [
    { r: 200, g: 80, b: 90 }, { r: 90, g: 150, b: 110 }, { r: 80, g: 120, b: 190 },
    { r: 230, g: 200, b: 140 }, { r: 120, g: 90, b: 150 }, { r: 60, g: 60, b: 60 },
    { r: 240, g: 240, b: 235 }, { r: 170, g: 120, b: 80 }
  ];
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = colors[i % colors.length];
    out.push(withLab({ r: c.r, g: c.g, b: c.b, x: (i % 64) / 64, y: 0.5 }));
  }
  return out;
}

/** Сумма долей ровно 100.0 с точностью до 0.05. */
export function sumShares(items) {
  return items.reduce((s, c) => s + c.percentage, 0);
}
