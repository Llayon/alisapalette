/**
 * Генератор гармоничных сочетаний на основе OKLCH.
 * - Никаких жёстких HSL-констант и произвольных RGB-правил.
 * - Нейтральные цвета обрабатываются отдельной стратегией (без случайных
 *   поворотов hue на 120/180 при C≈0).
 * - Разделены "сочетания из вашего фото" (только найденное) и
 *   "какие цвета можно добавить" (сгенерированное).
 */
import { rgbToOklch, oklchToRgb, rgbToHex, hueDiff, NEUTRAL_C, NEAR_NEUTRAL_C } from './color-science.js';
import { getPoeticColorName } from './poetic.js';

function hexOf(lch) {
  const rgb = oklchToRgb(lch);
  return { rgb, hex: rgbToHex(rgb), name: getPoeticColorName(rgb.r, rgb.g, rgb.b) };
}

function shiftHue(h, d) {
  if (h === null || !isFinite(h)) return 0;
  return (((h + d) % 360) + 360) % 360;
}

export function isNeutralBase(rgb) {
  return rgbToOklch(rgb).C < NEAR_NEUTRAL_C;
}

/**
 * Три главные рекомендации для выбранного цвета:
 * { calm, contrast, accent } — каждая { title, explain, swatches: [{rgb,hex,name,source}] }
 * source: 'photo' | 'suggested'.
 */
export function trioForColor(baseRgb, palette = []) {
  const lch = rgbToOklch(baseRgb);
  const neutral = lch.C < NEAR_NEUTRAL_C;
  if (neutral) return neutralTrio(baseRgb, lch, palette);
  return chromaticTrio(baseRgb, lch, palette);
}

function swatch(lch, source = 'suggested') {
  const h = hexOf(lch);
  return { ...h, lch, source };
}

function baseSwatch(baseRgb, lch) {
  return {
    rgb: baseRgb,
    hex: rgbToHex(baseRgb),
    name: getPoeticColorName(baseRgb.r, baseRgb.g, baseRgb.b),
    lch,
    source: 'photo',
    badge: 'выбран'
  };
}

/**
 * Температура нейтрали: собственный hue (если информативен при C>=0.008),
 * иначе голос хроматичных соседей по фото, иначе тёплый default для lifestyle.
 * Возвращает число 0..360 (никогда null).
 */
function neutralTempH(lch, palette = []) {
  if (lch.H !== null && lch.C >= 0.008) return lch.H;
  const chrom = (palette || [])
    .map((p) => rgbToOklch(p))
    .filter((o) => o.C >= 0.05 && o.H !== null);
  if (chrom.length) {
    const warm = chrom.filter((o) => (o.H >= 20 && o.H <= 110) || o.H >= 340).length;
    return warm >= chrom.length / 2 ? 75 : 250;
  }
  return 75;
}

/**
 * Тональная растяжка вокруг исходной светлоты: тёмный остаётся тёмным,
 * светлый — светлым. Всегда 3–4 ступени.
 */
function tonalSteps(L, tempH, C) {
  const c = Math.max(0.012, Math.min(C, 0.035));
  const clampL = (v) => Math.min(0.95, Math.max(0.12, v));
  const out = [];
  for (const t of [L - 0.22, L - 0.08, L + 0.08, L + 0.24]) {
    const Lc = clampL(t);
    if (out.length && Math.abs(Lc - out[out.length - 1].L) < 0.06) continue;
    out.push({ L: Lc, C: c, H: tempH });
  }
  return out;
}

function chromaticTrio(baseRgb, lch, palette) {
  const { L, C, H } = lch;
  const softC = Math.max(0.03, Math.min(C * 0.92, 0.11));

  // Спокойно: тональное + аналоговое, приглушённые (не синтетика).
  const calmSw = [
    baseSwatch(baseRgb, lch),
    swatch({ L: Math.min(0.95, L + 0.13), C: softC * 0.55, H }),
    swatch({ L: Math.max(0.18, L - 0.13), C: softC * 0.8, H: shiftHue(H, 22) }),
    swatch({ L, C: softC, H: shiftHue(H, -24) })
  ];

  // Контрастно: противоположная область, но контролируемая chroma и светлота.
  const compL = L > 0.68 ? 0.42 : L < 0.35 ? 0.74 : 0.55;
  const compC = Math.max(0.05, Math.min(C, 0.13));
  const contrastSw = [
    baseSwatch(baseRgb, lch),
    swatch({ L: compL, C: compC, H: shiftHue(H, 180) }),
    swatch({ L: Math.min(0.93, (L + compL) / 2 + 0.12), C: 0.025, H: shiftHue(H, 180) })
  ];

  // Акцент: сдержанная нейтральная база + один выразительный оттенок.
  const warmNeutral = { L: Math.min(0.92, Math.max(L, 0.72)), C: 0.022, H: 75 };
  const deepNeutral = { L: 0.28, C: 0.02, H: shiftHue(H, 180) };
  const accentSw = [
    swatch(warmNeutral),
    swatch(deepNeutral),
    baseSwatch(baseRgb, lch),
    swatch({ L: L > 0.6 ? 0.5 : 0.68, C: Math.max(0.1, Math.min(0.17, C + 0.04)), H })
  ];

  return {
    calm: {
      id: 'calm', title: 'Спокойно',
      explain: 'Близкие оттенки и тональные переходы — сдержанное решение в духе фото.',
      swatches: calmSw
    },
    contrast: {
      id: 'contrast', title: 'Контрастно',
      explain: 'Противоположная область цветового круга с контролируемой насыщенностью.',
      swatches: contrastSw
    },
    accent: {
      id: 'accent', title: 'Акцент',
      explain: 'Спокойная база и один выразительный оттенок.',
      swatches: accentSw
    }
  };
}

function neutralTrio(baseRgb, lch, palette = []) {
  const { L, C } = lch;
  const base = baseSwatch(baseRgb, lch);
  const tempH = neutralTempH(lch, palette);
  const steps = tonalSteps(L, tempH, C);
  const lightest = steps.reduce((a, b) => (b.L > a.L ? b : a), steps[0]);
  const mid = steps[Math.floor(steps.length / 2)];

  // Точный акцент из фото (без модификации!) либо сдержанный предложенный.
  const photoAccent = (palette || [])
    .map((p) => ({ p, l: rgbToOklch(p) }))
    .filter((o) => o.l.C >= 0.06 && Math.abs(o.l.L - L) > 0.08)
    .sort((a, b) => b.l.C - a.l.C)[0];
  let accentSw;
  let accentExplain;
  if (photoAccent) {
    const p = photoAccent.p;
    accentSw = {
      rgb: { r: p.r, g: p.g, b: p.b },
      hex: rgbToHex(p.r, p.g, p.b),
      name: getPoeticColorName(p.r, p.g, p.b),
      lch: photoAccent.l,
      source: 'photo',
      badge: 'из фото'
    };
    accentExplain = 'Нейтральная база плюс оттенок, уже встречающийся в кадре (без изменений).';
  } else {
    const warmRegion = (tempH >= 20 && tempH <= 110) || tempH >= 340;
    accentSw = swatch({ L: 0.52, C: 0.09, H: warmRegion ? 30 : 200 });
    accentExplain = 'Нейтральная база плюс один сдержанный выразительный оттенок.';
  }

  const opposite = L > 0.55
    ? { L: 0.25, C: 0.018, H: tempH }
    : { L: 0.92, C: 0.018, H: tempH };

  return {
    calm: {
      id: 'calm', title: 'Спокойно',
      explain: 'Тональные переходы вокруг исходной светлоты — без резких пятен.',
      swatches: [base, ...steps.map((s) => swatch(s))]
    },
    contrast: {
      id: 'contrast', title: 'Контрастно',
      explain: 'Контраст по светлоте относительно исходного оттенка.',
      swatches: [base, swatch(opposite), swatch(mid)]
    },
    accent: {
      id: 'accent', title: 'Акцент',
      explain: accentExplain,
      swatches: [base, swatch(lightest), accentSw]
    }
  };
}

// ---------- классические гармонии (6 типов) ----------

export function classicalHarmonies(baseRgb) {
  const lch = rgbToOklch(baseRgb);
  const out = {};
  if (lch.C < NEAR_NEUTRAL_C) {
    // Нейтрали генерируются ОТ исходного OKLCH (светлота + температура),
    // а не фиксированным пресетом: тёплое молочное, холодное серое и графит
    // дают разные, уместные им ряды. Исходный цвет всегда первый («выбран»).
    const tempH = neutralTempH(lch, []);
    const base = baseSwatch(baseRgb, lch);
    const steps = tonalSteps(lch.L, tempH, lch.C);
    const clampL = (v) => Math.min(0.95, Math.max(0.12, v));
    out.monochrome = {
      id: 'monochrome', title: 'Монохромная',
      explain: 'Тональные ступени вокруг светлоты исходного оттенка.',
      swatches: [base, ...steps.slice(0, 3).map((s) => swatch(s))]
    };
    out.analogous = {
      id: 'analogous', title: 'Аналоговая',
      explain: 'Сдержанные нейтрали с лёгким уходом в тёплую и холодную сторону.',
      swatches: [
        base,
        swatch({ L: clampL(lch.L - 0.06), C: 0.028, H: shiftHue(tempH, -18) }),
        swatch({ L: clampL(lch.L - 0.14), C: 0.028, H: shiftHue(tempH, 18) })
      ]
    };
    out.neutral = {
      id: 'neutral', title: 'Нейтральная',
      explain: 'Исходный оттенок плюс тёплая светлая и холодная средняя нейтрали.',
      swatches: [
        base,
        swatch({ L: 0.9, C: 0.018, H: 80 }),
        swatch({ L: clampL(lch.L - 0.05), C: 0.018, H: 250 })
      ]
    };
    out.complementary = {
      id: 'complementary', title: 'Комплементарная',
      explain: 'К ахроматическим цветам круг не применяется — показан светлотный контраст с исходным.',
      swatches: [base, swatch({ L: lch.L > 0.6 ? 0.28 : 0.9, C: 0.015, H: tempH })]
    };
    out.split = {
      id: 'split', title: 'Разделённо-комплементарная',
      explain: 'Для нейтралей заменена тональной растяжкой от исходного.',
      swatches: [base, ...steps.slice(0, 2).map((s) => swatch(s))]
    };
    out.triad = {
      id: 'triad', title: 'Триадная',
      explain: 'К нейтралям не применяется механически — показаны три ступени от исходного.',
      swatches: [base, ...steps.slice(1, 3).map((s) => swatch(s))]
    };
    return out;
  }

  const { L, C, H } = lch;
  const c = Math.max(0.04, Math.min(C, 0.12));
  // Каждая гармония начинается с точного исходного цвета («выбран»):
  // преобразованные версии показаны рядом и не подменяют его.
  const base = baseSwatch(baseRgb, lch);
  out.monochrome = {
    id: 'monochrome', title: 'Монохромная',
    explain: 'Оттенки близкого hue с продуманными различиями по светлоте и chroma.',
    swatches: [
      base,
      swatch({ L: Math.min(0.94, L + 0.18), C: c * 0.45, H }),
      swatch({ L: Math.min(0.9, L + 0.07), C: c * 0.75, H }),
      swatch({ L, C: c, H }),
      swatch({ L: Math.max(0.2, L - 0.14), C: c * 0.9, H })
    ]
  };
  out.analogous = {
    id: 'analogous', title: 'Аналоговая',
    explain: 'Близкие оттенки цветового круга для спокойной композиции.',
    swatches: [base, swatch({ L, C: c, H: shiftHue(H, -28) }), swatch({ L, C: c, H }), swatch({ L, C: c, H: shiftHue(H, 28) })]
  };
  out.complementary = {
    id: 'complementary', title: 'Комплементарная',
    explain: 'Цветовой контраст с противоположной областью круга.',
    swatches: [base, swatch({ L: L > 0.65 ? 0.45 : 0.7, C: c, H: shiftHue(H, 180) })]
  };
  out.split = {
    id: 'split', title: 'Разделённо-комплементарная',
    explain: 'Основной оттенок и два цвета рядом с противоположным hue.',
    swatches: [base, swatch({ L, C: c, H: shiftHue(H, 150) }), swatch({ L, C: c, H: shiftHue(H, 210) })]
  };
  out.triad = {
    id: 'triad', title: 'Триадная',
    explain: 'Три различающихся направления на цветовом круге.',
    swatches: [base, swatch({ L, C: c, H: shiftHue(H, 120) }), swatch({ L, C: c, H: shiftHue(H, 240) })]
  };
  out.neutral = {
    id: 'neutral', title: 'Нейтральная',
    explain: 'Основной цвет и подходящие тёплые либо холодные нейтрали.',
    swatches: [
      base,
      swatch({ L: 0.9, C: 0.02, H: 80 }),
      swatch({ L: 0.35, C: 0.022, H: 75 })
    ]
  };
  return out;
}

// ---------- "сочетания из вашего фото" ----------

/**
 * Ищет пары/тройки среди УЖЕ извлечённых цветов (новых не создаёт).
 * Возвращает { found: [...], note } — честно пусто, если цветов недостаточно.
 */
export function inPhotoCombinations(palette) {
  const items = (palette || []).map((p) => ({ p, lch: rgbToOklch(p), hex: rgbToHex(p.r, p.g, p.b) }));
  const chrom = items.filter((o) => o.lch.C >= NEUTRAL_C && o.lch.H !== null);
  const found = [];

  if (items.length >= 2) {
    // Лучшая аналоговая пара
    let bestA = null, bestAd = Infinity;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i].lch, b = items[j].lch;
        if (a.C < NEUTRAL_C || b.C < NEUTRAL_C || a.H === null || b.H === null) continue;
        const d = hueDiff(a.H, b.H);
        if (d < 40 && d < bestAd) { bestAd = d; bestA = [items[i], items[j]]; }
      }
    }
    if (bestA) found.push({ kind: 'analogous', title: 'Спокойная пара из кадра', members: bestA, explain: `Разница hue ≈ ${Math.round(bestAd)}° — близкие оттенки.` });
  }

  if (chrom.length >= 2) {
    let bestC = null, bestCd = -1;
    for (let i = 0; i < chrom.length; i++) {
      for (let j = i + 1; j < chrom.length; j++) {
        const d = hueDiff(chrom[i].lch.H, chrom[j].lch.H);
        const score = d >= 140 && d <= 220 ? d : -1;
        if (score > bestCd) { bestCd = score; bestC = [chrom[i], chrom[j]]; }
      }
    }
    if (bestC) found.push({ kind: 'complementary', title: 'Контрастная пара из кадра', members: bestC, explain: `Разница hue ≈ ${Math.round(bestCd)}° — противоположные области круга.` });
  }

  if (chrom.length >= 3) {
    // Триада: ищем тройку с попарными разницами ближе к 120
    let bestT = null, bestTs = Infinity;
    for (let i = 0; i < chrom.length; i++) {
      for (let j = i + 1; j < chrom.length; j++) {
        for (let k = j + 1; k < chrom.length; k++) {
          const ds = [
            hueDiff(chrom[i].lch.H, chrom[j].lch.H),
            hueDiff(chrom[j].lch.H, chrom[k].lch.H),
            hueDiff(chrom[i].lch.H, chrom[k].lch.H)
          ];
          const err = Math.abs(ds[0] - 120) + Math.abs(ds[1] - 120) + Math.abs(ds[2] - 120);
          if (err < bestTs) { bestTs = err; bestT = [chrom[i], chrom[j], chrom[k]]; }
        }
      }
    }
    if (bestT && bestTs < 150) found.push({ kind: 'triad', title: 'Тройка из кадра', members: bestT, explain: 'Три направления, уже встречающиеся в фото.' });
  }

  let note;
  if (!found.length) {
    note = chrom.length < 2
      ? 'В фотографии недостаточно различных хроматических цветов для парных сочетаний — ниже предложены оттенки, которые можно добавить.'
      : 'Подходящих пар среди извлечённых цветов не нашлось — ниже предложены оттенки, которые можно добавить.';
  }
  return { found, note };
}
