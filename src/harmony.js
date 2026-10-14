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

function chromaticTrio(baseRgb, lch, palette) {
  const { L, C, H } = lch;
  const softC = Math.max(0.03, Math.min(C * 0.92, 0.11));
  const baseHex = rgbToHex(baseRgb);

  // Спокойно: тональное + аналоговое, приглушённые (не синтетика).
  const calmSw = [
    { rgb: baseRgb, hex: baseHex, name: getPoeticColorName(baseRgb.r, baseRgb.g, baseRgb.b), lch, source: 'photo' },
    swatch({ L: Math.min(0.95, L + 0.13), C: softC * 0.55, H }),
    swatch({ L: Math.max(0.18, L - 0.13), C: softC * 0.8, H: shiftHue(H, 22) }),
    swatch({ L, C: softC, H: shiftHue(H, -24) })
  ];

  // Контрастно: противоположная область, но контролируемая chroma и светлота.
  const compL = L > 0.68 ? 0.42 : L < 0.35 ? 0.74 : 0.55;
  const compC = Math.max(0.05, Math.min(C, 0.13));
  const contrastSw = [
    { rgb: baseRgb, hex: baseHex, name: getPoeticColorName(baseRgb.r, baseRgb.g, baseRgb.b), lch, source: 'photo' },
    swatch({ L: compL, C: compC, H: shiftHue(H, 180) }),
    swatch({ L: Math.min(0.93, (L + compL) / 2 + 0.12), C: 0.025, H: shiftHue(H, 180) })
  ];

  // Акцент: сдержанная нейтральная база + один выразительный оттенок.
  const warmNeutral = { L: Math.min(0.92, Math.max(L, 0.72)), C: 0.022, H: 75 };
  const deepNeutral = { L: 0.28, C: 0.02, H: shiftHue(H, 180) };
  const accentSw = [
    swatch(warmNeutral),
    swatch(deepNeutral),
    { rgb: baseRgb, hex: baseHex, name: getPoeticColorName(baseRgb.r, baseRgb.g, baseRgb.b), lch, source: 'photo' },
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

function neutralTrio(baseRgb, lch, palette) {
  const { L } = lch;
  const baseHex = rgbToHex(baseRgb);
  const baseName = getPoeticColorName(baseRgb.r, baseRgb.g, baseRgb.b);
  const base = { rgb: baseRgb, hex: baseHex, name: baseName, lch, source: 'photo' };

  // Определяем температуру исходника по ближайшим хроматичным соседям в фото,
  // иначе — тёплая по умолчанию для lifestyle (но честно: «нейтральная база»).
  let warmBias = true;
  const chrom = (palette || []).map((p) => ({ p, l: rgbToOklch(p) })).filter((o) => o.l.C >= 0.05);
  if (chrom.length) {
    const warm = chrom.filter((o) => (o.l.H >= 20 && o.l.H <= 110) || o.l.H >= 340).length;
    warmBias = warm >= chrom.length / 2;
  }

  const lightN = { L: 0.93, C: 0.018, H: warmBias ? 80 : 250 };
  const midN = { L: 0.62, C: 0.028, H: warmBias ? 70 : 240 };
  const deepN = { L: 0.3, C: 0.022, H: warmBias ? 60 : 250 };

  // Сдержанный акцент: берём реальный акцент из фото, если есть.
  let accentLch = null;
  let accentSrc = 'suggested';
  const photoAccent = (palette || [])
    .map((p) => ({ p, l: rgbToOklch(p) }))
    .filter((o) => o.l.C >= 0.06 && Math.abs(o.l.L - L) > 0.08)
    .sort((a, b) => b.l.C - a.l.C)[0];
  if (photoAccent) {
    accentLch = { L: Math.min(0.62, Math.max(0.42, photoAccent.l.L)), C: Math.min(0.15, photoAccent.l.C), H: photoAccent.l.H };
    accentSrc = 'photo-suggestion';
  } else {
    accentLch = { L: 0.52, C: 0.09, H: warmBias ? 30 : 200 }; // приглушённый, не синтетика
  }

  return {
    calm: {
      id: 'calm', title: 'Спокойно',
      explain: 'Тональные переходы нейтралей — без резких цветовых пятен.',
      swatches: [base, swatch(lightN), swatch(midN), swatch(deepN)]
    },
    contrast: {
      id: 'contrast', title: 'Контрастно',
      explain: 'Контраст по светлоте: светлая нейтраль против глубокой.',
      swatches: [base, swatch({ L: L > 0.6 ? 0.25 : 0.92, C: 0.02, H: warmBias ? 75 : 250 }), swatch(midN)]
    },
    accent: {
      id: 'accent', title: 'Акцент',
      explain: photoAccent
        ? 'Нейтральная база плюс оттенок, уже встречающийся в кадре.'
        : 'Нейтральная база плюс один сдержанный выразительный оттенок.',
      swatches: [base, swatch(lightN), { ...swatch(accentLch), source: accentSrc }]
    }
  };
}

// ---------- классические гармонии (6 типов) ----------

export function classicalHarmonies(baseRgb) {
  const lch = rgbToOklch(baseRgb);
  const out = {};
  if (lch.C < NEAR_NEUTRAL_C) {
    out.monochrome = {
      id: 'monochrome', title: 'Монохромная',
      explain: 'Несколько оттенков близкой нейтрали с продуманными различиями по светлоте.',
      swatches: [
        swatch({ L: 0.92, C: 0.018, H: 80 }), swatch({ L: 0.74, C: 0.024, H: 75 }),
        swatch({ L: 0.55, C: 0.026, H: 70 }), swatch({ L: 0.34, C: 0.022, H: 65 })
      ]
    };
    out.analogous = {
      id: 'analogous', title: 'Аналоговая',
      explain: 'Для нейтралей — тёплая либо холодная сдержанная палитра.',
      swatches: [swatch({ L: 0.9, C: 0.02, H: 80 }), swatch({ L: 0.68, C: 0.035, H: 65 }), swatch({ L: 0.45, C: 0.03, H: 50 })]
    };
    out.neutral = {
      id: 'neutral', title: 'Нейтральная',
      explain: 'Тёплые и холодные нейтрали плюс контраст по светлоте.',
      swatches: [swatch({ L: 0.93, C: 0.018, H: 80 }), swatch({ L: 0.7, C: 0.02, H: 250 }), swatch({ L: 0.32, C: 0.02, H: 70 })]
    };
    out.complementary = {
      id: 'complementary', title: 'Комплементарная',
      explain: 'К ахроматическим цветам круг не применяется — показан светлотный контраст.',
      swatches: [swatch({ L: lch.L, C: 0.015, H: 90 }), swatch({ L: lch.L > 0.6 ? 0.28 : 0.9, C: 0.015, H: 250 })]
    };
    out.split = {
      id: 'split', title: 'Разделённо-комплементарная',
      explain: 'Для нейтралей заменена тональной растяжкой.',
      swatches: [swatch({ L: 0.9, C: 0.015, H: 80 }), swatch({ L: 0.6, C: 0.02, H: 80 }), swatch({ L: 0.32, C: 0.02, H: 80 })]
    };
    out.triad = {
      id: 'triad', title: 'Триадная',
      explain: 'К нейтралям не применяется механически — показаны три ступени светлоты.',
      swatches: [swatch({ L: 0.88, C: 0.015, H: 90 }), swatch({ L: 0.6, C: 0.015, H: 90 }), swatch({ L: 0.34, C: 0.015, H: 90 })]
    };
    return out;
  }

  const { L, C, H } = lch;
  const c = Math.max(0.04, Math.min(C, 0.12));
  out.monochrome = {
    id: 'monochrome', title: 'Монохромная',
    explain: 'Оттенки близкого hue с продуманными различиями по светлоте и chroma.',
    swatches: [
      swatch({ L: Math.min(0.94, L + 0.18), C: c * 0.45, H }),
      swatch({ L: Math.min(0.9, L + 0.07), C: c * 0.75, H }),
      swatch({ L, C: c, H }),
      swatch({ L: Math.max(0.2, L - 0.14), C: c * 0.9, H })
    ]
  };
  out.analogous = {
    id: 'analogous', title: 'Аналоговая',
    explain: 'Близкие оттенки цветового круга для спокойной композиции.',
    swatches: [swatch({ L, C: c, H: shiftHue(H, -28) }), swatch({ L, C: c, H }), swatch({ L, C: c, H: shiftHue(H, 28) })]
  };
  out.complementary = {
    id: 'complementary', title: 'Комплементарная',
    explain: 'Цветовой контраст с противоположной областью круга.',
    swatches: [swatch({ L, C: c, H }), swatch({ L: L > 0.65 ? 0.45 : 0.7, C: c, H: shiftHue(H, 180) })]
  };
  out.split = {
    id: 'split', title: 'Разделённо-комплементарная',
    explain: 'Основной оттенок и два цвета рядом с противоположным hue.',
    swatches: [swatch({ L, C: c, H }), swatch({ L, C: c, H: shiftHue(H, 150) }), swatch({ L, C: c, H: shiftHue(H, 210) })]
  };
  out.triad = {
    id: 'triad', title: 'Триадная',
    explain: 'Три различающихся направления на цветовом круге.',
    swatches: [swatch({ L, C: c, H }), swatch({ L, C: c, H: shiftHue(H, 120) }), swatch({ L, C: c, H: shiftHue(H, 240) })]
  };
  out.neutral = {
    id: 'neutral', title: 'Нейтральная',
    explain: 'Основной цвет и подходящие тёплые либо холодные нейтрали.',
    swatches: [
      swatch({ L, C: c, H }),
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
