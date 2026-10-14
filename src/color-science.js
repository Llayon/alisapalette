/**
 * ChromaStyle — color science foundation (OKLab / OKLCH).
 *
 * Все операции локальные, без сервера и ИИ.
 * Терминология намеренно точная: евклидово расстояние в OKLab
 * НЕ называется CIEDE2000 и НЕ называется "ΔE" без уточнения.
 */

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export function clamp01(v) {
  return clamp(v, 0, 1);
}

// ---------- sRGB <-> linear light ----------

export function srgbChannelToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function linearToSrgbChannel(v) {
  const x = clamp01(v);
  const s = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  return clamp(Math.round(s * 255), 0, 255);
}

export function rgbToLinear(rgb) {
  return {
    r: srgbChannelToLinear(rgb.r),
    g: srgbChannelToLinear(rgb.g),
    b: srgbChannelToLinear(rgb.b)
  };
}

export function linearToRgb(lin) {
  if (!isFinite(lin.r) || !isFinite(lin.g) || !isFinite(lin.b)) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: linearToSrgbChannel(lin.r),
    g: linearToSrgbChannel(lin.g),
    b: linearToSrgbChannel(lin.b)
  };
}

// ---------- linear sRGB -> OKLab (Björn Ottosson) ----------

export function linearToOklab(lin) {
  const l = 0.4122214708 * lin.r + 0.5363325363 * lin.g + 0.0514459929 * lin.b;
  const m = 0.2119034982 * lin.r + 0.6806995451 * lin.g + 0.1073969566 * lin.b;
  const s = 0.0883024619 * lin.r + 0.2817188376 * lin.g + 0.6299787005 * lin.b;
  const l_ = Math.cbrt(Math.max(0, l));
  const m_ = Math.cbrt(Math.max(0, m));
  const s_ = Math.cbrt(Math.max(0, s));
  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  };
}

export function oklabToLinear(lab) {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.2914855480 * lab.b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  };
}

export function rgbToOklab(rgb) {
  return linearToOklab(rgbToLinear(rgb));
}

export function oklabToRgb(lab) {
  if (!isFinite(lab.L) || !isFinite(lab.a) || !isFinite(lab.b)) {
    return { r: 0, g: 0, b: 0 };
  }
  return linearToRgb(oklabToLinear(lab));
}

// ---------- OKLab <-> OKLCH ----------

export function oklabToOklch(lab) {
  const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let H = null;
  // hue информативен только при заметной chroma
  if (C >= 0.0004) {
    H = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
    if (H < 0) H += 360;
  }
  return { L: lab.L, C, H };
}

export function oklchToOklab(lch) {
  const C = Math.max(0, lch.C || 0);
  const hRad = (((lch.H ?? 0) % 360) + 360) % 360 * (Math.PI / 180);
  return {
    L: clamp(lch.L, 0, 1),
    a: C * Math.cos(hRad),
    b: C * Math.sin(hRad)
  };
}

export function rgbToOklch(rgb) {
  return oklabToOklch(rgbToOklab(rgb));
}

// ---------- distances & luminance ----------

/** Перцепционное евклидово расстояние в OKLab (НЕ CIEDE2000). */
export function oklabDistance(lab1, lab2) {
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  const d = Math.sqrt(dL * dL + da * da + db * db);
  return isFinite(d) ? d : Infinity;
}

/** То же для sRGB-пар: удобный мост для старого кода. */
export function oklabDistanceRgb(c1, c2) {
  return oklabDistance(rgbToOklab(c1), rgbToOklab(c2));
}

/**
 * Относительная яркость по определению sRGB (WCAG), НЕ взвешенная
 * сумма байтов 0.2126*r+... — используется линеаризация.
 */
export function relativeLuminance(rgb) {
  const lin = rgbToLinear(rgb);
  return 0.2126 * lin.r + 0.7152 * lin.g + 0.0722 * lin.b;
}

/** Текст на цветном фоне: '#0c0a09' или '#ffffff'. */
export function textOnColor(rgb) {
  return relativeLuminance(rgb) > 0.35 ? '#0c0a09' : '#ffffff';
}

// ---------- neutral handling ----------

export const NEUTRAL_C = 0.02; // chroma ниже — нейтраль
export const NEAR_NEUTRAL_C = 0.04; // почти нейтраль

export function chromaOf(rgb) {
  return rgbToOklch(rgb).C;
}

export function isNeutralRgb(rgb, threshold = NEUTRAL_C) {
  return chromaOf(rgb) < threshold;
}

export function isNearNeutralRgb(rgb, threshold = NEAR_NEUTRAL_C) {
  return chromaOf(rgb) < threshold;
}

/** Тёплая нейтраль (крем/беж) vs холодная (серо-голубая) по hue. null для ахроматики. */
export function neutralTemperature(rgb) {
  const lch = rgbToOklch(rgb);
  if (lch.C < 0.008 || lch.H === null) return 'neutral';
  const h = lch.H;
  // тёплые: красные/оранжевые/жёлтые ~ 20..110
  if ((h >= 20 && h <= 110) || h >= 340) return 'warm';
  if (h >= 150 && h <= 300) return 'cool';
  return 'neutral';
}

// ---------- gamut mapping ----------

/** Проверка: все ли компоненты sRGB внутри [0,255] (с малым допуском). */
export function linearInGamut(lin, eps = 1e-6) {
  return lin.r >= -eps && lin.r <= 1 + eps && lin.g >= -eps && lin.g <= 1 + eps && lin.b >= -eps && lin.b <= 1 + eps;
}

/**
 * OKLCH -> sRGB с gamut mapping: при выходе за sRGB уменьшаем chroma
 * с сохранением hue и lightness (бинарный поиск, ~12 итераций).
 * Всегда возвращает корректный {r,g,b} без NaN/Infinity.
 */
export function oklchToRgb(lch) {
  const L = clamp(isFinite(lch.L) ? lch.L : 0.5, 0, 1);
  let C = Math.max(0, isFinite(lch.C) ? lch.C : 0);
  const H = isFinite(lch.H) ? (((lch.H % 360) + 360) % 360) : 0;

  const direct = oklabToLinear(oklchToOklab({ L, C, H }));
  if (linearInGamut(direct)) return linearToRgb(direct);

  // Бинарный поиск максимальной влезающей chroma
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const lin = oklabToLinear(oklchToOklab({ L, C: mid, H }));
    if (linearInGamut(lin)) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-4) break;
  }
  // Крайний случай: даже серая точка вне gamut (L за пределами) — клампим.
  const best = oklabToLinear(oklchToOklab({ L, C: lo, H }));
  const clamped = {
    r: clamp01(best.r),
    g: clamp01(best.g),
    b: clamp01(best.b)
  };
  return linearToRgb(clamped);
}

// ---------- hex / css ----------

export function rgbToHex(r, g, b) {
  if (typeof r === 'object') {
    b = r.b; g = r.g; r = r.r;
  }
  const c = [r, g, b].map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('');
  return ('#' + c).toUpperCase();
}

export function hexToRgb(hex) {
  const clean = String(hex).trim().replace('#', '');
  const short = clean.length === 3 ? clean.split('').map((ch) => ch + ch).join('') : clean;
  const num = parseInt(short.slice(0, 6), 16);
  if (!isFinite(num)) return { r: 0, g: 0, b: 0 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Короткая угловая разница hue в градусах [0..180]. */
export function hueDiff(a, b) {
  if (a === null || b === null || !isFinite(a) || !isFinite(b)) return Infinity;
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}
