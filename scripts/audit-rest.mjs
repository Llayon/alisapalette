/** AUDIT B-rest: propose603010 dup, WCAG ratios, perfume floors. */
import { relativeLuminance } from '../src/color-science.js';

function ratio(fg, bg) {
  const l1 = relativeLuminance(fg), l2 = relativeLuminance(bg);
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}
const BG = { r: 12, g: 10, b: 9 };
const CARD = { r: 28, g: 25, b: 23 };
for (const [name, fg, onCard] of [
  ['muted #A8A29E', { r: 168, g: 162, b: 158 }, false],
  ['faint #78716C', { r: 120, g: 113, b: 108 }, false],
  ['rose-badge #FDA4AF', { r: 253, g: 164, b: 175 }, false],
  ['amber #FBBF24', { r: 251, g: 191, b: 36 }, false],
  ['white', { r: 255, g: 255, b: 255 }, false],
  ['faint-on-card', { r: 120, g: 113, b: 108 }, true],
  ['muted-on-card', { r: 168, g: 162, b: 158 }, true],
]) {
  const bg = onCard ? CARD : BG;
  console.log(`${name}: ${ratio(fg, bg).toFixed(2)} (AA-normal>=4.5)`);
}

// propose603010 dup simulation (logic copy): 2 colors 70/30, 1 color
function sim(sorted) {
  const base = sorted[0];
  const rest = sorted.slice(1);
  const companion = rest.find((c) => c.percentage >= 8) || rest[0];
  const accent = [...sorted].sort((a, b) => b.C - a.C).find((c) => c.percentage <= 18) || sorted[sorted.length - 1];
  return { base: base.n, companion: companion && companion.n, accent: accent && accent.n };
}
console.log('2 colors:', JSON.stringify(sim([{ n: 'A', percentage: 70, C: 0.05 }, { n: 'B', percentage: 30, C: 0.09 }])));
console.log('1 color:', JSON.stringify(sim([{ n: 'A', percentage: 100, C: 0.05 }])));
console.log('3 colors:', JSON.stringify(sim([{ n: 'A', percentage: 61, C: 0.01 }, { n: 'B', percentage: 33, C: 0.02 }, { n: 'C', percentage: 6, C: 0.1 }])));
