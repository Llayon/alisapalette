/**
 * Парфюмерный движок и каталог — перенесены из прототипа без изменения
 * сути (регрессионная совместимость gauntlet). Единственная замена:
 * Redmean colorDistance -> перцепционное расстояние в OKLab.
 */
import { hexToRgb, oklabDistanceRgb } from './color-science.js';

export const OLFACTORY_ARCHETYPES = [
  { id: 'lactonic_cashmere', familyName: 'Лактонно-пудровый и кашемировый мускус', poeticTitle: 'Кашемировое облако и миндальное молоко', r: 242, g: 232, b: 218, topNotes: ['Белый бергамот', 'Розовый перец', 'Альдегиды чистоты'], heartNotes: ['Миндальное молоко', 'Цветок хлопка', 'Белый ирис'], baseNotes: ['Кашмеран', 'Белый мускус', 'Сливочный сандал'], vector: { lactonic: 95, gourmand: 45, fresh: 40, green: 10, floral: 55, woody: 60 } },
  { id: 'warm_gourmand', familyName: 'Пряно-гурманский и согревающий амбровый', poeticTitle: 'Пряный латте, солёная карамель и сандал', r: 185, g: 132, b: 88, topNotes: ['Кардамон', 'Корица Цейлон', 'Жареный фундук'], heartNotes: ['Солёная карамель', 'Абсолют кофе', 'Сливочный пралине'], baseNotes: ['Мадагаскарская ваниль', 'Бобы тонка', 'Сандаловое дерево'], vector: { lactonic: 65, gourmand: 96, fresh: 10, green: 15, floral: 20, woody: 82 } },
  { id: 'dark_cherry_oud', familyName: 'Глубокий восточно-гурманский и винный', poeticTitle: 'Винный бархат, тёмная вишня и амбра', r: 92, g: 28, b: 36, topNotes: ['Чёрная вишня', 'Горький миндаль', 'Выдержанный ликёр'], heartNotes: ['Турецкая роза', 'Слива Мирабель', 'Гвоздика и корица'], baseNotes: ['Перуанский бальзам', 'Дымный ветивер', 'Тёмный шоколад и пачули'], vector: { lactonic: 30, gourmand: 92, fresh: 5, green: 10, floral: 48, woody: 90 } },
  { id: 'rose_peony_chypre', familyName: 'Цветочно-пудровый и фруктово-шипровый', poeticTitle: 'Шёлковый пион, личи и розовая пудра', r: 222, g: 158, b: 172, topNotes: ['Сочный личи', 'Ревень', 'Розовый грейпфрут'], heartNotes: ['Дамасская роза', 'Розовый пион', 'Лепестки фиалки'], baseNotes: ['Ванильная пудра', 'Белый кедр', 'Шёлковый мускус'], vector: { lactonic: 75, gourmand: 40, fresh: 45, green: 25, floral: 98, woody: 35 } },
  { id: 'green_matcha_fig', familyName: 'Зелёный фужерный и инжирно-чайный', poeticTitle: 'Лист инжира, утренняя матча и шалфей', r: 148, g: 172, b: 142, topNotes: ['Лист молодого инжира', 'Японский чай Матча', 'Цедра бергамота'], heartNotes: ['Шалфей мускатный', 'Инжирное молочко', 'Лист смородины'], baseNotes: ['Свежий ветивер', 'Кора белого кедра', 'Мягкий мате'], vector: { lactonic: 45, gourmand: 20, fresh: 72, green: 98, floral: 35, woody: 68 } },
  { id: 'marine_mineral', familyName: 'Акватический, минеральный и озоновый', poeticTitle: 'Морская соль, голубая гортензия и бриз', r: 118, g: 164, b: 208, topNotes: ['Морская соль', 'Сицилийский лимон', 'Озоновый воздух'], heartNotes: ['Голубая гортензия', 'Шалфей на ветру', 'Белый чай'], baseNotes: ['Амброксан', 'Мокрая древесина', 'Минеральный мускус'], vector: { lactonic: 35, gourmand: 5, fresh: 98, green: 55, floral: 45, woody: 52 } },
  { id: 'citrus_amber_sun', familyName: 'Солнечный цитрусово-амбровый', poeticTitle: 'Нероли, золотое шампанское и тёплая амбра', r: 238, g: 185, b: 84, topNotes: ['Красный сицилийский апельсин', 'Мандарин', 'Игристое шампанское'], heartNotes: ['Цветы нероли', 'Жасмин самбак', 'Медовый османтус'], baseNotes: ['Золотая амбра', 'Сухое дерево', 'Тёплый бензоин'], vector: { lactonic: 40, gourmand: 58, fresh: 84, green: 30, floral: 75, woody: 55 } },
  { id: 'graphite_mineral_wood', familyName: 'Нишевый минерально-древесный и замшевый', poeticTitle: 'Тонкая замша, минеральный аккорд и кедр', r: 68, g: 72, b: 78, topNotes: ['Лист фиалки', 'Сычуаньский перец', 'Итальянский мандарин'], heartNotes: ['Тонкая замша', 'Бессмертник', 'Минеральный озон'], baseNotes: ['Акигалавуд', 'Атласский кедр', 'Дымный ладан'], vector: { lactonic: 25, gourmand: 20, fresh: 60, green: 45, floral: 20, woody: 96 } }
];

export const PERFUME_CATALOG = [
  { brand: 'Byredo', name: 'Blanche', store: 'Золотое Яблоко / Randewoo', hex: '#F5F5F7', density: 0.85, notes: 'Альдегиды, белая роза, пион, фиалка, сандал и мускус чистой рубашки', vector: { lactonic: 92, gourmand: 10, fresh: 78, green: 20, floral: 82, woody: 40 } },
  { brand: 'Zadig & Voltaire', name: 'This is Her!', store: 'Золотое Яблоко / Рив Гош', hex: '#F8F1E5', density: 1.35, notes: 'Взбитые сливки, розовый перец, каштан, ваниль, кашмеран и сандал', vector: { lactonic: 98, gourmand: 80, fresh: 15, green: 10, floral: 45, woody: 78 } },
  { brand: 'Le Labo', name: 'The Matcha 26', store: 'Randewoo / ЦУМ', hex: '#A8C08A', density: 1.0, notes: 'Японский чай матча, сливочный инжир, горький апельсин, ветивер и кедр', vector: { lactonic: 58, gourmand: 25, fresh: 68, green: 96, floral: 25, woody: 76 } },
  { brand: 'Diptyque', name: 'Philosykos', store: 'Золотое Яблоко / Randewoo', hex: '#8EA592', density: 0.9, notes: 'Лист и плод греческого инжира, кокосовое молочко, зелёные ноты и белый кедр', vector: { lactonic: 62, gourmand: 20, fresh: 75, green: 98, floral: 30, woody: 65 } },
  { brand: 'Tom Ford', name: 'Lost Cherry', store: 'Randewoo / Золотое Яблоко', hex: '#621626', density: 1.55, notes: 'Спелая вишня, вишнёвый ликёр, горький миндаль, турецкая роза, бобы тонка и сандал', vector: { lactonic: 35, gourmand: 96, fresh: 10, green: 10, floral: 52, woody: 84 } },
  { brand: 'Kilian', name: "Angels' Share", store: 'Randewoo / Иль де Ботэ', hex: '#C6864E', density: 1.7, notes: 'Коньячная эссенция, корица, пралине, бобы тонка, ваниль и дубовая бочка', vector: { lactonic: 45, gourmand: 98, fresh: 5, green: 10, floral: 15, woody: 92 } },
  { brand: 'Parfums de Marly', name: 'Delina', store: 'Randewoo / Золотое Яблоко', hex: '#E8A5B2', density: 1.4, notes: 'Турецкая роза, пион, сочный личи, ревень, мускатный орех, ваниль и кашмеран', vector: { lactonic: 72, gourmand: 42, fresh: 52, green: 30, floral: 98, woody: 42 } },
  { brand: 'Jo Malone', name: 'Wood Sage & Sea Salt', store: 'Randewoo / Золотое Яблоко', hex: '#A4C6E4', density: 0.75, notes: 'Морская соль, мускатный шалфей, семена амбретты, грейпфрут и красные водоросли', vector: { lactonic: 30, gourmand: 5, fresh: 96, green: 65, floral: 30, woody: 58 } },
  { brand: 'Essential Parfums', name: 'Bois Impérial', store: 'Золотое Яблоко', hex: '#8C9284', density: 1.5, notes: 'Тайский базилик, грейпфрут, непальский перец Тимут, ветивер и молекула Акигалавуд', vector: { lactonic: 15, gourmand: 10, fresh: 82, green: 78, floral: 15, woody: 96 } },
  { brand: 'Marc-Antoine Barrois', name: 'Ganymede', store: 'Золотое Яблоко / Randewoo', hex: '#BDA285', density: 1.65, notes: 'Итальянский мандарин, шафран, тонкая замша, лист фиалки, бессмертник и акигалавуд', vector: { lactonic: 25, gourmand: 30, fresh: 65, green: 40, floral: 30, woody: 95 } }
];

export const bloggerProducts = [
  { id: 'p1', title: 'Объёмный кардиган из мягкой шерсти', store: 'WB', sku: 'Арт. 18492031', hex: '#D8C6B4', category: 'Гардероб' },
  { id: 'p2', title: 'Классический тренч оверсайз', store: 'Lamoda', sku: 'Арт. MP002XW08', hex: '#BDA285', category: 'Верхняя одежда' },
  { id: 'p3', title: 'Увлажняющий тинт-бальзам для губ', store: 'Золотое Яблоко', sku: 'Арт. 19000142', hex: '#C48A91', category: 'Макияж' },
  { id: 'p4', title: 'Кожаная сумка-багет в винном оттенке', store: 'WB', sku: 'Арт. 21049582', hex: '#621626', category: 'Аксессуары' },
  { id: 'p5', title: 'Джинсы прямого кроя на высокой посадке', store: 'Lamoda', sku: 'Арт. RTLAC941', hex: '#4A7098', category: 'Деним' },
  { id: 'p6', title: 'Ароматическая свеча в керамике «Инжир и Шалфей»', store: 'WB', sku: 'Арт. 16382910', hex: '#8EA592', category: 'Уют дома' },
  { id: 'p7', title: 'Шёлковая пижама в оттенке топлёного молока', store: 'WB', sku: 'Арт. 19940211', hex: '#F8F1E5', category: 'Дом и сон' },
  { id: 'p8', title: 'Кремовые румяна с эффектом свечения', store: 'Золотое Яблоко', sku: 'Арт. 19008812', hex: '#E8A5B2', category: 'Макияж' },
  { id: 'p9', title: 'Плед крупной вязки «Солёная карамель»', store: 'WB', sku: 'Арт. 15029384', hex: '#C6864E', category: 'Уют дома' },
  { id: 'p10', title: 'Керамическая кружка ручной работы «Матча»', store: 'WB', sku: 'Арт. 20491823', hex: '#A8C08A', category: 'Сервировка' },
  { id: 'p11', title: 'Кашемировый шарф в оттенке горького шоколада', store: 'Lamoda', sku: 'Арт. MP002XM91', hex: '#3E2920', category: 'Аксессуары' },
  { id: 'p12', title: 'Льняная рубашка свободного кроя «Гортензия»', store: 'WB', sku: 'Арт. 22819304', hex: '#A4C6E4', category: 'Гардероб' }
];

export function getClosestOlfactoryArchetype(color) {
  let best = OLFACTORY_ARCHETYPES[0];
  let minDist = Infinity;
  for (const arch of OLFACTORY_ARCHETYPES) {
    const d = oklabDistanceRgb(color, arch);
    if (d < minDist) { minDist = d; best = arch; }
  }
  return best;
}

export function computeAccordCosineSimilarity(vA, vB) {
  const keys = ['lactonic', 'gourmand', 'fresh', 'green', 'floral', 'woody'];
  let dot = 0, magA = 0, magB = 0;
  for (const k of keys) {
    const a = vA[k] || 0, b = vB[k] || 0;
    dot += a * b; magA += a * a; magB += b * b;
  }
  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function calculateSprayDosage(density = 1.15, weatherTemp = 20, occasion = 'walk') {
  const occasionMultipliers = { office: 0.65, walk: 1.25, date: 0.9, party: 1.35 };
  const occMult = occasionMultipliers[occasion] || 1.0;
  const volatility = density * Math.exp(0.028 * (weatherTemp - 20));
  const rawSprays = (3.2 * occMult) / volatility;
  const sprays = Math.max(1, Math.min(5, Math.round(rawSprays)));
  return { sprays, volatility: Number(volatility.toFixed(2)) };
}

/** Совпадение товаров каталога с палитрой через OKLab-расстояние. */
export function matchProducts(palette, products = bloggerProducts, topN = 4) {
  if (!palette.length) return [];
  const scored = products.map((prod) => {
    const prodRgb = hexToRgb(prod.hex);
    let bestDist = Infinity;
    let matched = palette[0];
    for (const c of palette) {
      const d = oklabDistanceRgb(prodRgb, c);
      if (d < bestDist) { bestDist = d; matched = c; }
    }
    const matchScore = Math.max(72, Math.min(99, Math.round(100 - bestDist * 130)));
    return { ...prod, matchScore, bestDist, matched };
  });
  scored.sort((a, b) => a.bestDist - b.bestDist);
  return scored.slice(0, topN);
}
