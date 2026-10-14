/** AUDIT: куда теряются 40% акцента 1%? */
import { stratifiedSample } from '../src/sampling.js';
import { analyzePixels, resetIdCounter } from '../src/palette.js';
import { rgbToOklab } from '../src/color-science.js';

const W = 400, H = 300;
const data = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const c = y / H > 0.99 ? { r: 98, g: 22, b: 38 } : { r: 225, g: 210, b: 190 };
  const i = (y * W + x) * 4;
  data[i] = c.r; data[i + 1] = c.g; data[i + 2] = c.b; data[i + 3] = 255;
}
const img = { width: W, height: H, data };
const truth = (() => { let w = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (y / H > 0.99) w++; return w / (W * H); })();
console.log('truth share:', (truth * 100).toFixed(3) + '%');

const s = stratifiedSample(img, { target: 9000 });
const wineS = s.filter((p) => p.r - p.g > 30).length;
console.log(`sample n=${s.length} wineInSample=${wineS} (${(wineS / s.length * 100).toFixed(2)}%)`);
const ys = [...new Set(s.filter((p) => p.r - p.g > 30).map((p) => Math.round(p.y * H)))];
console.log('wine sample rows:', ys.join(','));

resetIdCounter();
const items = analyzePixels(s, { algorithm: 'photo', colorCount: 6, minDelta: 28 });
for (const it of items) console.log(`  #${it.r},${it.g},${it.b} ${it.percentage}% count=${it.count} role=${it.role}`);
