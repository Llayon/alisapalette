/**
 * Словарь POETIC_COLORS сохранён из прототипа (lifestyle-характер),
 * но выбор ближайшего названия переведён на перцепционную метрику OKLab.
 * Поэтическое имя — декоративная подпись, точный цвет не меняется.
 */
import { oklabDistanceRgb, isNearNeutralRgb, rgbToOklch, neutralTemperature } from './color-science.js';

export const POETIC_COLORS = [
  { name: 'Топлёное молоко', r: 248, g: 241, b: 229 },
  { name: 'Шёлковый жемчуг', r: 245, g: 245, b: 247 },
  { name: 'Взбитые сливки', r: 252, g: 248, b: 242 },
  { name: 'Сливочное масло', r: 253, g: 238, b: 196 },
  { name: 'Льняной холст', r: 234, g: 224, b: 210 },
  { name: 'Миндальное молоко', r: 238, g: 223, b: 208 },
  { name: 'Ванильный пломбир', r: 249, g: 239, b: 218 },
  { name: 'Кашемировый беж', r: 216, g: 198, b: 180 },
  { name: 'Овсяное печенье', r: 204, g: 181, b: 155 },
  { name: 'Тёплый тренч', r: 189, g: 162, b: 133 },
  { name: 'Пряный латте', r: 175, g: 138, b: 108 },
  { name: 'Солёная карамель', r: 198, g: 134, b: 78 },
  { name: 'Корица и кардамон', r: 156, g: 98, b: 62 },
  { name: 'Молочный шоколад', r: 118, g: 78, b: 56 },
  { name: 'Утренний эспрессо', r: 62, g: 41, b: 32 },
  { name: 'Горький трюфель', r: 42, g: 30, b: 26 },
  { name: 'Балетная пудра', r: 244, g: 219, b: 216 },
  { name: 'Розовый кварц', r: 236, g: 196, b: 199 },
  { name: 'Лепесток пиона', r: 232, g: 165, b: 178 },
  { name: 'Пыльная роза', r: 196, g: 138, b: 145 },
  { name: 'Сухая роза', r: 168, g: 108, b: 116 },
  { name: 'Клубничный мусс', r: 238, g: 132, b: 148 },
  { name: 'Малиновый сорбет', r: 212, g: 62, b: 98 },
  { name: 'Спелая вишня', r: 138, g: 28, b: 48 },
  { name: 'Винный бархат (Бургунди)', r: 98, g: 22, b: 38 },
  { name: 'Гранатовый сок', r: 165, g: 32, b: 42 },
  { name: 'Персиковый румянец', r: 248, g: 196, b: 172 },
  { name: 'Абрикосовый джем', r: 242, g: 155, b: 104 },
  { name: 'Тосканская терракота', r: 194, g: 98, b: 72 },
  { name: 'Обожжённая глина', r: 162, g: 78, b: 56 },
  { name: 'Алый шёлк', r: 218, g: 44, b: 44 },
  { name: 'Янтарный мёд', r: 235, g: 168, b: 52 },
  { name: 'Золотое шампанское', r: 238, g: 212, b: 158 },
  { name: 'Пряная охра', r: 198, g: 142, b: 48 },
  { name: 'Солнечный лимон', r: 248, g: 218, b: 78 },
  { name: 'Фисташковое мороженое', r: 204, g: 224, b: 188 },
  { name: 'Матча латте', r: 168, g: 192, b: 138 },
  { name: 'Шалфей и эвкалипт', r: 142, g: 165, b: 146 },
  { name: 'Средиземноморская олива', r: 118, g: 128, b: 78 },
  { name: 'Мятная прохлада', r: 168, g: 228, b: 208 },
  { name: 'Хвойный лес', r: 34, g: 78, b: 54 },
  { name: 'Благородный изумруд', r: 18, g: 112, b: 84 },
  { name: 'Тёмный мох', r: 52, g: 68, b: 48 },
  { name: 'Утренний туман', r: 214, g: 224, b: 232 },
  { name: 'Голубая гортензия', r: 164, g: 198, b: 228 },
  { name: 'Парижское небо', r: 118, g: 168, b: 216 },
  { name: 'Французский деним', r: 74, g: 112, b: 152 },
  { name: 'Глубокий сапфир', r: 32, g: 62, b: 118 },
  { name: 'Полночный океан', r: 18, g: 34, b: 64 },
  { name: 'Лазурный берег', r: 38, g: 166, b: 188 },
  { name: 'Морская волна', r: 22, g: 118, b: 128 },
  { name: 'Лавандовый туман', r: 212, g: 198, b: 228 },
  { name: 'Нежная сирень', r: 186, g: 158, b: 212 },
  { name: 'Прованская лаванда', r: 148, g: 116, b: 188 },
  { name: 'Спелый инжир', r: 92, g: 56, b: 98 },
  { name: 'Ежевичный джем', r: 58, g: 32, b: 68 },
  { name: 'Серебристый шёлк', r: 206, g: 208, b: 212 },
  { name: 'Тёплый камень (Тауп)', r: 154, g: 144, b: 138 },
  { name: 'Лондонский дождь', r: 118, g: 122, b: 128 },
  { name: 'Мокрый асфальт', r: 72, g: 76, b: 82 },
  { name: 'Графитовый кашемир', r: 44, g: 46, b: 50 },
  { name: 'Чёрный оникс', r: 18, g: 18, b: 20 }
];

// Предвычисленные OKLab-координаты словаря (для скорости).
import { rgbToOklab } from './color-science.js';
const POETIC_LAB = POETIC_COLORS.map((c) => ({ name: c.name, lab: rgbToOklab(c) }));

/**
 * Ближайшее поэтическое название по перцепционному расстоянию в OKLab.
 * - Почти точное совпадение со словарём — сразу (сохраняет
 *   «Шалфей и эвкалипт» для приглушённой зелени и т.п.).
 * - Для почти нейтральных целей хроматичные кандидаты штрафуются
 *   пропорционально их chroma: серый не станет «бежем», а тёплый
 *   крем не станет «холодным туманом».
 */
export function getPoeticColorName(r, g, b) {
  const target = typeof r === 'object' ? r : { r, g, b };
  const nearNeutral = isNearNeutralRgb(target);
  const targetLab = rgbToOklab(target);
  const targetC = rgbToOklch(target).C;

  let bestName = 'Благородный оттенок';
  let bestScore = Infinity;
  let rawBest = Infinity;
  let rawName = bestName;
  for (const entry of POETIC_LAB) {
    const dL = targetLab.L - entry.lab.L;
    const da = targetLab.a - entry.lab.a;
    const db = targetLab.b - entry.lab.b;
    const d = Math.sqrt(dL * dL + da * da + db * db);
    if (d < rawBest) { rawBest = d; rawName = entry.name; }
    let score = d;
    if (nearNeutral) {
      const cand = POETIC_COLORS.find((c) => c.name === entry.name);
      const candC = rgbToOklch(cand).C;
      score += Math.max(0, candC - targetC) * 1.5;
    }
    if (score < bestScore) { bestScore = score; bestName = entry.name; }
  }
  // Почти точное совпадение со словарём важнее штрафа нейтралей.
  if (rawBest < 0.015) return rawName;
  return bestName;
}

/** Короткая характеристика нейтрали для UI (молочный/тауп/графит...). */
export function neutralCaption(rgb) {
  const lch = rgbToOklch(rgb);
  if (lch.C >= 0.04) return null;
  const temp = neutralTemperature(rgb);
  const L = lch.L;
  const level = L > 0.9 ? 'светлая нейтраль' : L > 0.7 ? 'средне-светлая нейтраль' : L > 0.35 ? 'средняя нейтраль' : 'тёмная нейтраль';
  const warmth = temp === 'warm' ? 'тёплая' : temp === 'cool' ? 'холодная' : 'нейтральная по температуре';
  return `${level}, ${warmth}`;
}
