/** AUDIT: массовый roundtrip + gamut + нейтрали. node scripts/audit-color.mjs */
import {
  rgbToOklab, oklabToRgb, oklabToOklch, oklchToRgb, rgbToOklch,
  oklabDistance, hueDiff, linearInGamut, rgbToLinear, NEUTRAL_C, NEAR_NEUTRAL_C
} from '../src/color-science.js';

// Детерминированный генератор: 20k цветов (сетка + LCG)
function* genColors() {
  let seed = 987654321;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let r = 0; r <= 255; r += 17)
    for (let g = 0; g <= 255; g += 17)
      for (let b = 0; b <= 255; b += 17) yield { r, g, b };
  for (let i = 0; i < 3000; i++) yield { r: rnd() * 256 | 0, g: rnd() * 256 | 0, b: rnd() * 256 | 0 };
}

let n = 0, maxErr = 0, sumErr = 0, worst = null, nanCount = 0;
for (const c of genColors()) {
  n++;
  const back = oklabToRgb(rgbToOklab(c));
  for (const k of ['r', 'g', 'b']) {
    if (!Number.isFinite(back[k])) nanCount++;
    const e = Math.abs(back[k] - c[k]);
    sumErr += e;
    if (e > maxErr) { maxErr = e; worst = { c, back }; }
  }
}
console.log(`roundtrip n=${n} maxErr=${maxErr.toFixed(3)} meanErr=${(sumErr / (n * 3)).toFixed(4)} nan=${nanCount}`);
console.log('worst:', JSON.stringify(worst));

// Gamut: насыщенные цвета
const vivid = {
  red: { L: 0.55, C: 0.25, H: 30 }, blue: { L: 0.5, C: 0.25, H: 270 },
  green: { L: 0.7, C: 0.28, H: 150 }, violet: { L: 0.5, C: 0.28, H: 310 },
  orange: { L: 0.65, C: 0.28, H: 60 }
};
for (const [name, lch] of Object.entries(vivid)) {
  const rgb = oklchToRgb(lch);
  const back = rgbToOklch(rgb);
  const inGamut = [rgb.r, rgb.g, rgb.b].every((v) => v >= 0 && v <= 255);
  const hueJump = back.H === null ? 'null' : hueDiff(lch.H, back.H).toFixed(1);
  console.log(`gamut ${name}: rgb=${rgb.r},${rgb.g},${rgb.b} inGamut=${inGamut} hueJump=${hueJump} C ${lch.C}->${back.C.toFixed(3)}`);
}

// Нейтрали + шум: серый 128 + шум ±3 — классификация стабильна?
import { isNeutralRgb, isNearNeutralRgb } from '../src/color-science.js';
let flips = 0;
for (let dr = -3; dr <= 3; dr++) for (let dg = -3; dg <= 3; dg++) for (let db = -3; db <= 3; db++) {
  const c = { r: 128 + dr, g: 128 + dg, b: 128 + db };
  if (!isNeutralRgb(c)) flips++;
}
console.log(`neutral gray128±3 flips: ${flips}/343`);
// Пороги: C на границах
for (const c of [{ r: 200, g: 190, b: 180 }, { r: 216, g: 198, b: 180 }, { r: 142, g: 165, b: 146 }, { r: 154, g: 144, b: 138 }]) {
  const lch = rgbToOklch(c);
  console.log(`C(${c.r},${c.g},${c.b})=${lch.C.toFixed(4)} neutral=${lch.C < NEUTRAL_C} near=${lch.C < NEAR_NEUTRAL_C} H=${lch.H}`);
}
// Hue wrap 359<->1
console.log('hueDiff(359,1) =', hueDiff(359, 1));
// Тёмные/светлые крайности roundtrip
for (const c of [{ r: 5, g: 4, b: 6 }, { r: 250, g: 251, b: 249 }, { r: 1, g: 1, b: 1 }]) {
  const back = oklabToRgb(rgbToOklab(c));
  console.log(`extreme ${JSON.stringify(c)} -> ${JSON.stringify(back)}`);
}
