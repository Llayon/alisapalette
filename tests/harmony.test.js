import { describe, it, expect, beforeEach } from 'vitest';
import { trioForColor, classicalHarmonies, inPhotoCombinations } from '../src/harmony.js';
import { rgbToOklch, rgbToHex, oklchToRgb } from '../src/color-science.js';
import { getPoeticColorName } from '../src/poetic.js';
import { resetIdCounter } from '../src/palette.js';

beforeEach(() => resetIdCounter());

function validSwatches(swatches) {
  for (const s of swatches) {
    expect(s.hex).toMatch(/^#[0-9A-F]{6}$/);
    expect([s.rgb.r, s.rgb.g, s.rgb.b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)).toBe(true);
    expect(typeof s.name).toBe('string');
    expect(s.name.length).toBeGreaterThan(0);
  }
}

describe('trio: спокой/контраст/акцент', () => {
  it('хроматическая база: три рекомендации по 3-5 свотчей, HEX валидны', () => {
    const base = { r: 74, g: 112, b: 152 }; // деним
    const trio = trioForColor(base, [
      { r: 74, g: 112, b: 152, percentage: 45, center: { L: 0.5, a: 0, b: 0 } },
      { r: 216, g: 198, b: 180, percentage: 35, center: { L: 0.8, a: 0, b: 0 } },
      { r: 98, g: 22, b: 38, percentage: 8, center: { L: 0.3, a: 0.1, b: 0 } }
    ]);
    for (const k of ['calm', 'contrast', 'accent']) {
      expect(trio[k].swatches.length).toBeGreaterThanOrEqual(3);
      expect(trio[k].swatches.length).toBeLessThanOrEqual(5);
      validSwatches(trio[k].swatches);
    }
  });
  it('нейтральная база не даёт случайной синтетики', () => {
    const gray = { r: 150, g: 148, b: 146 }; // тауп
    const trio = trioForColor(gray, [{ r: 150, g: 148, b: 146, percentage: 80, center: {} }]);
    // спокой и контраст — только сдержанные chroma
    for (const s of [...trio.calm.swatches, ...trio.contrast.swatches]) {
      expect(rgbToOklch(s.rgb).C).toBeLessThan(0.06);
    }
    // акцент — максимум один выразительный
    const vivid = trio.accent.swatches.filter((s) => rgbToOklch(s.rgb).C > 0.1);
    expect(vivid.length).toBeLessThanOrEqual(1);
    validSwatches(trio.accent.swatches);
  });
  it('приглушённая база даёт приглушённые рекомендации', () => {
    const sage = { r: 142, g: 165, b: 146 };
    const trio = trioForColor(sage, []);
    const calmMax = Math.max(...trio.calm.swatches.map((s) => rgbToOklch(s.rgb).C));
    expect(calmMax).toBeLessThan(0.14);
  });
});

describe('классические гармонии', () => {
  it('комплемент хроматики ~180°', () => {
    const base = { r: 200, g: 60, b: 60 };
    const h = classicalHarmonies(base);
    const baseH = rgbToOklch(base).H;
    const comp = h.complementary.swatches[1];
    const compH = rgbToOklch(comp.rgb).H;
    let d = Math.abs(baseH - compH) % 360;
    if (d > 180) d = 360 - d;
    expect(d).toBeGreaterThan(150);
    expect(d).toBeLessThan(210);
  });
  it('триада разнесена', () => {
    const base = { r: 60, g: 120, b: 200 };
    const h = classicalHarmonies(base);
    expect(h.triad.swatches.length).toBe(3);
    validSwatches(h.triad.swatches);
  });
  it('все 6 типов существуют и для нейтралей без NaN', () => {
    for (const base of [{ r: 200, g: 60, b: 60 }, { r: 150, g: 150, b: 150 }, { r: 20, g: 20, b: 22 }]) {
      const h = classicalHarmonies(base);
      for (const k of ['monochrome', 'analogous', 'complementary', 'split', 'triad', 'neutral']) {
        expect(h[k]).toBeDefined();
        validSwatches(h[k].swatches);
      }
    }
  });
});

describe('in-photo combinations', () => {
  it('честно пусто, когда цветов мало', () => {
    const { found, note } = inPhotoCombinations([{ r: 200, g: 200, b: 200, percentage: 100 }]);
    expect(found.length).toBe(0);
    expect(note).toMatch(/недостаточно/);
  });
  it('находит аналоговую пару, не создаёт новых цветов', () => {
    const pal = [
      { r: 232, g: 165, b: 178, percentage: 40 },
      { r: 196, g: 138, b: 145, percentage: 35 },
      { r: 118, g: 128, b: 78, percentage: 25 }
    ];
    const { found } = inPhotoCombinations(pal);
    expect(found.length).toBeGreaterThanOrEqual(1);
    for (const f of found) {
      for (const m of f.members) {
        const inPal = pal.some((p) => p.r === m.p.r && p.g === m.p.g && p.b === m.p.b);
        expect(inPal).toBe(true);
      }
    }
  });
});

describe('нейтральные гармонии зависят от источника (аудит 1b)', () => {
  const milk = { r: 248, g: 241, b: 229 };
  const coldGray = { r: 170, g: 178, b: 186 };
  const graphite = { r: 44, g: 46, b: 50 };
  const meanL = (sw) => sw.reduce((s, x) => s + rgbToOklch(x.rgb).L, 0) / sw.length;

  it('монохром молочного светлее монохрома графита минимум на 0.2', () => {
    const m = meanL(classicalHarmonies(milk).monochrome.swatches);
    const g = meanL(classicalHarmonies(graphite).monochrome.swatches);
    expect(m - g).toBeGreaterThan(0.2);
  });
  it('холодное серое даёт более холодный ряд, чем молочное', () => {
    const warmHue = (h) => (h >= 20 && h <= 110) || h >= 340;
    const coldRow = classicalHarmonies(coldGray).analogous.swatches.slice(1);
    const milkRow = classicalHarmonies(milk).analogous.swatches.slice(1);
    const coldWarmCount = coldRow.filter((s) => { const H = rgbToOklch(s.rgb).H; return H !== null && warmHue(H); }).length;
    const milkWarmCount = milkRow.filter((s) => { const H = rgbToOklch(s.rgb).H; return H !== null && warmHue(H); }).length;
    expect(milkWarmCount).toBeGreaterThanOrEqual(coldWarmCount);
    expect(meanL(classicalHarmonies(coldGray).monochrome.swatches)).toBeLessThan(meanL(classicalHarmonies(milk).monochrome.swatches));
  });
  it('исходный HEX присутствует в КАЖДОЙ классической гармонии (включая нейтрали)', () => {
    for (const base of [milk, coldGray, graphite, { r: 200, g: 60, b: 60 }]) {
      const hex = rgbToHex(base.r, base.g, base.b);
      const h = classicalHarmonies(base);
      for (const k of ['monochrome', 'analogous', 'complementary', 'split', 'triad', 'neutral']) {
        expect(h[k].swatches.some((s) => s.hex === hex)).toBe(true);
      }
    }
  });
  it('нейтральное трио: тёмное остаётся тёмным, светлое — светлым', () => {
    const darkCalm = trioForColor(graphite, []).calm.swatches;
    expect(Math.max(...darkCalm.map((s) => rgbToOklch(s.rgb).L))).toBeLessThan(0.75);
    const lightCalm = trioForColor({ r: 250, g: 250, b: 248 }, []).calm.swatches;
    expect(Math.min(...lightCalm.map((s) => rgbToOklch(s.rgb).L))).toBeGreaterThan(0.5);
  });
  it('точный акцент из фото не модифицируется и помечен «из фото»', () => {
    const base = { r: 245, g: 245, b: 244 };
    const pal = [
      { r: 245, g: 245, b: 244, percentage: 80, center: {} },
      { r: 150, g: 30, b: 40, percentage: 6, center: {} }
    ];
    const t = trioForColor(base, pal);
    const acc = t.accent.swatches.find((s) => s.badge === 'из фото');
    expect(acc).toBeDefined();
    expect([acc.rgb.r, acc.rgb.g, acc.rgb.b]).toEqual([150, 30, 40]);
    expect(acc.hex).toBe('#961E28');
  });
  it('никаких source=photo-suggestion: только точное фото или предложение', () => {
    const all = [];
    for (const base of [milk, coldGray, graphite]) {
      const t = trioForColor(base, [{ r: 150, g: 30, b: 40, percentage: 6, center: {} }]);
      all.push(...t.calm.swatches, ...t.contrast.swatches, ...t.accent.swatches);
    }
    expect(all.some((s) => s.source === 'photo-suggestion')).toBe(false);
    for (const s of all.filter((x) => x.source === 'photo')) {
      expect(['выбран', 'из фото'].includes(s.badge)).toBe(true);
    }
  });
});
describe('поэтические имена', () => {
  it('нейтрали не получают странных хроматических имён', () => {
    const neutrals = [
      { r: 248, g: 241, b: 229 }, { r: 154, g: 144, b: 138 },
      { r: 206, g: 208, b: 212 }, { r: 44, g: 46, b: 50 }
    ];
    const bad = ['Малиновый сорбет', 'Алый шёлк', 'Благородный изумруд', 'Морская волна'];
    for (const c of neutrals) {
      expect(bad).not.toContain(getPoeticColorName(c.r, c.g, c.b));
    }
  });
  it('чисто серые цели маппятся только на ахроматичные имена (регрессия: #BEBEBF был «бежем»)', () => {
    const allow = new Set([
      'Шёлковый жемчуг', 'Взбитые сливки', 'Серебристый шёлк', 'Утренний туман',
      'Лондонский дождь', 'Мокрый асфальт', 'Графитовый кашемир', 'Чёрный оникс',
      'Тёплый камень (Тауп)', 'Топлёное молоко', 'Льняной холст', 'Ванильный пломбир'
    ]);
    for (const c of [
      { r: 190, g: 190, b: 191 }, { r: 169, g: 169, b: 171 },
      { r: 150, g: 150, b: 151 }, { r: 111, g: 112, b: 114 }
    ]) {
      expect(allow.has(getPoeticColorName(c.r, c.g, c.b))).toBe(true);
    }
  });
  it('hex соответствует отображаемому цвету', () => {
    const rgb = oklchToRgb({ L: 0.6, C: 0.1, H: 250 });
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    expect(hex).toMatch(/^#[0-9A-F]{6}$/);
  });
});
