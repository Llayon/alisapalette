/** AUDIT palette: layout invariance, accent sizes, duplicates, share accuracy. */
import { stratifiedSample } from '../src/sampling.js';
import { analyzePixels, resetIdCounter } from '../src/palette.js';
import { rgbToOklab, oklabDistance } from '../src/color-science.js';

const MILK = { r: 245, g: 245, b: 244 };
const DENIM = { r: 74, g: 112, b: 152 };
const WINE = { r: 98, g: 22, b: 38 };

function makeImg(w, h, fn) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x / w, y / h);
    const i = (y * w + x) * 4;
    data[i] = c.r; data[i + 1] = c.g; data[i + 2] = c.b; data[i + 3] = 255;
  }
  return { width: w, height: h, data };
}
function analyze(img, colorCount = 6) {
  resetIdCounter();
  const px = stratifiedSample(img, { target: 9000 });
  return analyzePixels(px, { algorithm: 'photo', colorCount, minDelta: 28 });
}
const pct = (items, pred) => { const f = items.find(pred); return f ? f.percentage : 0; };

// 9 layouts, same set: milk 70 / denim 20 / wine 10
const layouts = {
  hStripes: (x, y) => (y < 0.7 ? MILK : y < 0.9 ? DENIM : WINE),
  vStripes: (x, y) => (x < 0.7 ? MILK : x < 0.9 ? DENIM : WINE),
  checker: (x, y) => { const c = ((x * 8 | 0) + (y * 8 | 0)) % 10; return c < 7 ? MILK : c < 9 ? DENIM : WINE; },
  center: (x, y) => { const dx = x - 0.5, dy = y - 0.5; const d = Math.sqrt(dx * dx + dy * dy); return d > 0.32 ? MILK : d > 0.2 ? DENIM : WINE; },
  corner: (x, y) => (x > 0.55 && y > 0.3 ? (x > 0.78 || y > 0.72 ? WINE : DENIM) : MILK),
  edgeBand: (x, y) => (y > 0.92 ? WINE : y > 0.72 ? DENIM : MILK),
  scattered: (x, y) => { const h = Math.abs(Math.sin(x * 91.7 + y * 47.3) * 43758.5) % 1; return h < 0.7 ? MILK : h < 0.9 ? DENIM : WINE; },
};
console.log('--- layout invariance (truth 70/20/10) ---');
for (const [name, fn] of Object.entries(layouts)) {
  const items = analyze(makeImg(400, 300, fn));
  const m = pct(items, (c) => c.r > 200);
  const d = pct(items, (c) => c.b - c.r > 40);
  const w = pct(items, (c) => c.r > 80 && c.r - c.g > 30);
  const sum = items.reduce((s, c) => s + c.percentage, 0);
  console.log(`${name}: milk=${m} denim=${d} wine=${w} n=${items.length} sum=${sum.toFixed(1)}`);
}

// accent sizes on beige bg (solid rect Anteil)
console.log('--- accent size sweep (beige bg + wine rect) ---');
for (const share of [0.001, 0.003, 0.005, 0.01, 0.03, 0.05, 0.1]) {
  const rows = Math.max(1, Math.round(300 * share));
  const items = analyze(makeImg(400, 300, (x, y) => (y > 1 - share ? WINE : { r: 225, g: 210, b: 190 })));
  const w = pct(items, (c) => c.r > 80 && c.r - c.g > 30);
  const wItem = items.find((c) => c.r > 80 && c.r - c.g > 30);
  console.log(`share=${(share * 100).toFixed(1)}% -> found=${w}% role=${wItem ? wItem.role : '-'} n=${items.length}`);
}

// duplicates: close beiges + grays + dark greens + pinks + near-whites + black/navy + pastels
console.log('--- duplicate stress ---');
const dupSets = {
  beiges: [{ r: 216, g: 198, b: 180 }, { r: 222, g: 202, b: 184 }, { r: 210, g: 194, b: 178 }],
  grays: [{ r: 120, g: 120, b: 121 }, { r: 130, g: 130, b: 131 }, { r: 140, g: 140, b: 141 }],
  darkGreens: [{ r: 34, g: 78, b: 54 }, { r: 40, g: 84, b: 58 }, { r: 52, g: 68, b: 48 }],
  pinks: [{ r: 232, g: 165, b: 178 }, { r: 236, g: 172, b: 182 }, { r: 228, g: 158, b: 172 }],
  nearWhites: [{ r: 250, g: 248, b: 244 }, { r: 245, g: 245, b: 247 }, { r: 252, g: 250, b: 245 }],
  blackNavy: [{ r: 18, g: 18, b: 20 }, { r: 18, g: 34, b: 64 }, { r: 25, g: 25, b: 28 }],
};
for (const [name, colors] of Object.entries(dupSets)) {
  resetIdCounter();
  const px = [];
  colors.forEach((c, k) => { for (let i = 0; i < 1500; i++) px.push({ ...c, x: k / 3, y: 0.5, lab: rgbToOklab(c) }); });
  const items = analyzePixels(px, { algorithm: 'photo', colorCount: 6, minDelta: 28 });
  const minD = items.length > 1 ? Math.min(...items.flatMap((a, i) => items.slice(i + 1).map((b) => oklabDistance(rgbToOklab(a), rgbToOklab(b))))) : 0;
  console.log(`${name}: n=${items.length} minPairDist=${minD.toFixed(4)}`);
}
