/** AUDIT harmony: нейтральные пресеты, сохранение базы, in-photo пороги, photo-suggestion. */
import { trioForColor, classicalHarmonies, inPhotoCombinations } from '../src/harmony.js';
import { rgbToOklch, rgbToHex, oklchToRgb, hueDiff } from '../src/color-science.js';

console.log('--- neutral classical: warm milk vs cold gray vs graphite ---');
for (const [name, rgb] of Object.entries({
  milk: { r: 248, g: 241, b: 229 }, coldGray: { r: 170, g: 178, b: 186 }, graphite: { r: 44, g: 46, b: 50 }
})) {
  const h = classicalHarmonies(rgb);
  const lch = rgbToOklch(rgb);
  console.log(`${name} L=${lch.L.toFixed(2)} C=${lch.C.toFixed(3)} H=${lch.H}`);
  for (const k of ['monochrome', 'analogous', 'neutral']) {
    const sw = h[k].swatches.map((s) => `${rgbToHex(s.rgb)} L=${rgbToOklch(s.rgb).L.toFixed(2)}`).join(' ');
    console.log(`  ${k}: ${sw}`);
  }
}

console.log('--- trio: calm diversity / contrast visibility / accent distinctness ---');
const bases = {
  denim: { r: 74, g: 112, b: 152 }, beige: { r: 216, g: 198, b: 180 },
  burgundy: { r: 98, g: 22, b: 38 }, creamPhoto: { r: 248, g: 241, b: 229 },
  nearBlack: { r: 25, g: 24, b: 26 }, nearWhite: { r: 250, g: 250, b: 248 }
};
for (const [name, rgb] of Object.entries(bases)) {
  const t = trioForColor(rgb, []);
  const stat = (sw) => sw.map((s) => { const l = rgbToOklch(s.rgb); return `${rgbToHex(s.rgb)}(L${l.L.toFixed(2)} C${l.C.toFixed(2)} H${l.H === null ? '-' : Math.round(l.H)}${s.source[0]})`; }).join(' ');
  console.log(`${name} ${rgbToHex(rgb)}:`);
  console.log(`  calm: ${stat(t.calm.swatches)}`);
  console.log(`  contrast: ${stat(t.contrast.swatches)}`);
  console.log(`  accent: ${stat(t.accent.swatches)}`);
}

console.log('--- base preservation: base HEX present in every harmony? ---');
for (const [name, rgb] of Object.entries(bases)) {
  const hex = rgbToHex(rgb);
  const t = trioForColor(rgb, []);
  const h = classicalHarmonies(rgb);
  const all = [...t.calm.swatches, ...t.contrast.swatches, ...t.accent.swatches,
    ...h.monochrome.swatches, ...h.analogous.swatches, ...h.complementary.swatches,
    ...h.split.swatches, ...h.triad.swatches, ...h.neutral.swatches];
  const hasBase = all.some((s) => s.hex === hex);
  console.log(`${name}: basePreserved=${hasBase}`);
}

console.log('--- inPhoto thresholds: near-identical triple claimed as triad? ---');
const mk = (r, g, b, percentage) => ({ r, g, b, percentage });
const triadLoose = [mk(232, 165, 178, 40), mk(228, 170, 175, 35), mk(200, 120, 130, 25)];
console.log('near-identical pinks:', JSON.stringify(inPhotoCombinations(triadLoose).found.map((f) => f.kind)));
const trueTriad = [mk(200, 60, 60, 40), mk(60, 150, 80, 35), mk(70, 110, 200, 25)];
console.log('true triad:', JSON.stringify(inPhotoCombinations(trueTriad).found.map((f) => f.kind)));
const twoColors = [mk(200, 200, 200, 60), mk(150, 150, 151, 40)];
console.log('two neutrals:', JSON.stringify(inPhotoCombinations(twoColors)));

console.log('--- photo-suggestion labeling ---');
const pal = [
  { r: 245, g: 245, b: 244, percentage: 80, center: {} },
  { r: 150, g: 30, b: 40, percentage: 6, center: {} }
];
const t2 = trioForColor({ r: 245, g: 245, b: 244 }, pal);
for (const s of t2.accent.swatches) {
  const exact = pal.some((p) => p.r === s.rgb.r && p.g === s.rgb.g && p.b === s.rgb.b);
  console.log(`accent swatch ${rgbToHex(s.rgb)} source=${s.source} exactInPhoto=${exact}`);
}
