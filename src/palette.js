/**
 * Извлечение палитры в перцепционном пространстве OKLab.
 *
 * Принципы:
 * - детерминизм: один и тот же вход -> один и тот же выход;
 * - центр кластера (OKLab) отдельно от репрезентативного пикселя (реальный цвет фото);
 * - если различимых цветов меньше запрошенных — возвращаем меньше, не выдумываем;
 * - доли в сумме ровно 100.0% (метод наибольших остатков).
 */
import { rgbToOklab, oklabDistance, rgbToOklch, clamp } from './color-science.js';

let __idCounter = 0;
export function resetIdCounter() { __idCounter = 0; }
export function makeId(prefix = 'pin') {
  __idCounter += 1;
  return `${prefix}-${__idCounter}`;
}

/** Маппинг старого слайдера minDelta (10..70) в порог OKLab. 28 -> ~0.075. */
export function minDeltaToOklab(minDelta) {
  return clamp(minDelta / 370, 0.025, 0.2);
}

function labOf(p) {
  return p.lab || rgbToOklab(p);
}

function distLab(a, b) {
  const dL = a.L - b.L, da = a.a - b.a, db = a.b - b.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

// ---------- deterministic K-Means in OKLab ----------

export function extractKMeans(pixels, k, minDelta = 28) {
  if (!pixels.length || k <= 0) return [];
  const mergeDist = minDeltaToOklab(minDelta);
  const labs = pixels.map(labOf);

  // K-Means++ детерминированный: первый — медиана по L, далее — farthest-point.
  const order = labs.map((l, i) => i).sort((a, b) => labs[a].L - labs[b].L);
  const centroids = [{ ...labs[order[Math.floor(order.length / 2)]] }];

  // Кандидаты для скорости — равномерная подвыборка (детерминированная).
  const stride = Math.max(1, Math.floor(pixels.length / 600));
  const candIdx = [];
  for (let i = 0; i < pixels.length; i += stride) candIdx.push(i);

  while (centroids.length < Math.min(k, pixels.length)) {
    let bestIdx = candIdx[0];
    let bestDist = -1;
    for (const i of candIdx) {
      let m = Infinity;
      for (const c of centroids) {
        const d = distLab(labs[i], c);
        if (d < m) m = d;
      }
      if (m > bestDist) { bestDist = m; bestIdx = i; }
    }
    if (bestDist < 1e-6) break; // все точки покрыты
    centroids.push({ ...labs[bestIdx] });
  }

  const n = centroids.length;
  let assignments = new Int32Array(pixels.length);

  for (let iter = 0; iter < 25; iter++) {
    const sums = Array.from({ length: n }, () => ({ L: 0, a: 0, b: 0, count: 0 }));
    // E-step
    for (let i = 0; i < pixels.length; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < n; c++) {
        const d = distLab(labs[i], centroids[c]);
        if (d < bd) { bd = d; best = c; }
      }
      assignments[i] = best;
      sums[best].L += labs[i].L;
      sums[best].a += labs[i].a;
      sums[best].b += labs[i].b;
      sums[best].count++;
    }
    // Пустые кластеры: пересеиваем дальней точкой
    for (let c = 0; c < n; c++) {
      if (sums[c].count === 0) {
        let far = 0, farD = -1;
        for (let i = 0; i < pixels.length; i += Math.max(1, Math.floor(pixels.length / 500))) {
          let m = Infinity;
          for (let cc = 0; cc < n; cc++) {
            if (cc === c) continue;
            const d = distLab(labs[i], centroids[cc]);
            if (d < m) m = d;
          }
          if (m > farD) { farD = m; far = i; }
        }
        centroids[c] = { ...labs[far] };
        sums[c].L = labs[far].L; sums[c].a = labs[far].a; sums[c].b = labs[far].b;
        sums[c].count = 1;
      }
    }
    // M-step
    let maxShift = 0;
    for (let c = 0; c < n; c++) {
      if (sums[c].count > 0) {
        const nl = { L: sums[c].L / sums[c].count, a: sums[c].a / sums[c].count, b: sums[c].b / sums[c].count };
        maxShift = Math.max(maxShift, distLab(nl, centroids[c]));
        centroids[c] = nl;
      }
    }
    if (maxShift < 1e-4) break;
  }

  // ВАЖНО (фикс старого дефекта): пересчитываем назначения ПОСЛЕ финальных центроидов.
  assignments = new Int32Array(pixels.length);
  const members = Array.from({ length: n }, () => []);
  for (let i = 0; i < pixels.length; i++) {
    let best = 0, bd = Infinity;
    for (let c = 0; c < n; c++) {
      const d = distLab(labs[i], centroids[c]);
      if (d < bd) { bd = d; best = c; }
    }
    assignments[i] = best;
    members[best].push(i);
  }

  const raw = [];
  for (let c = 0; c < n; c++) {
    if (!members[c].length) continue;
    const medoid = pickMedoid(pixels, labs, members[c], centroids[c]);
    raw.push({
      center: { ...centroids[c] },
      r: medoid.r, g: medoid.g, b: medoid.b,
      x: medoid.x, y: medoid.y,
      count: members[c].length
    });
  }

  return finalizeClusters(raw, pixels, { minDelta, mergeDist, wantK: k });
}

// ---------- Median Cut (коробки в RGB, медоид по OKLab) ----------

export function extractMedianCut(pixels, k, minDelta = 28) {
  if (!pixels.length || k <= 0) return [];
  const mergeDist = minDeltaToOklab(minDelta);
  const labs = pixels.map(labOf);
  let boxes = [pixels.map((_, i) => i)];

  while (boxes.length < k) {
    let target = -1, bestRange = -1, chan = 'r';
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.length < 2) continue;
      let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
      for (const idx of box) {
        const p = pixels[idx];
        if (p.r < rMin) rMin = p.r; if (p.r > rMax) rMax = p.r;
        if (p.g < gMin) gMin = p.g; if (p.g > gMax) gMax = p.g;
        if (p.b < bMin) bMin = p.b; if (p.b > bMax) bMax = p.b;
      }
      const rr = rMax - rMin, gg = gMax - gMin, bb = bMax - bMin;
      const m = Math.max(rr, gg, bb);
      if (m > bestRange) {
        bestRange = m; target = i;
        chan = rr >= gg && rr >= bb ? 'r' : gg >= rr && gg >= bb ? 'g' : 'b';
      }
    }
    if (target === -1 || bestRange === 0) break;
    const box = boxes.splice(target, 1)[0];
    box.sort((a, b) => pixels[a][chan] - pixels[b][chan]);
    const mid = Math.floor(box.length / 2);
    boxes.push(box.slice(0, mid), box.slice(mid));
  }

  const raw = boxes.filter((b) => b.length).map((box) => {
    let L = 0, a = 0, b2 = 0;
    for (const idx of box) { L += labs[idx].L; a += labs[idx].a; b2 += labs[idx].b; }
    const center = { L: L / box.length, a: a / box.length, b: b2 / box.length };
    const medoid = pickMedoid(pixels, labs, box, center);
    return { center, r: medoid.r, g: medoid.g, b: medoid.b, x: medoid.x, y: medoid.y, count: box.length };
  });

  return finalizeClusters(raw, pixels, { minDelta, mergeDist, wantK: k });
}

// ---------- Histogram peaks (OKLab-квантование + акцентный буст) ----------

export function extractHistogramPeaks(pixels, k, minDelta = 28) {
  if (!pixels.length || k <= 0) return [];
  const mergeDist = minDeltaToOklab(minDelta);
  // Квантование грубее в тёмных/нейтральных областях не требуется — единый шаг.
  const bins = new Map();
  for (let i = 0; i < pixels.length; i++) {
    const p = pixels[i];
    const key = ((p.r >> 4) << 8) | ((p.g >> 4) << 4) | (p.b >> 4);
    let e = bins.get(key);
    if (!e) {
      const lab = labOf(p);
      const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
      e = { count: 0, idx: i, C };
      bins.set(key, e);
    }
    e.count++;
  }
  const sorted = [...bins.values()].sort((x, y) => {
    // Прозрачный буст насыщенности: count * (1 + C*k), но умеренный, чтобы
    // одиночный шумовой пиксель не становился главным.
    const sx = x.count * (1 + Math.min(0.35, x.C) * 4);
    const sy = y.count * (1 + Math.min(0.35, y.C) * 4);
    return sy - sx;
  });

  const centers = [];
  const counts = [];
  const repIdx = [];
  for (const bin of sorted) {
    if (centers.length >= k * 2) break;
    const p = pixels[bin.idx];
    const lab = labOf(p);
    let merged = false;
    for (let c = 0; c < centers.length; c++) {
      if (distLab(lab, centers[c]) < mergeDist * 0.8) {
        counts[c] += bin.count;
        merged = true;
        break;
      }
    }
    if (!merged) {
      centers.push(lab);
      counts.push(bin.count);
      repIdx.push(bin.idx);
    }
  }
  // Топ-k по count (стабильно), медоид-уточнение не требуется — уже реальные пиксели.
  const order = centers.map((_, i) => i).sort((a, b) => counts[b] - counts[a]).slice(0, k);
  const raw = order.map((i) => {
    const p = pixels[repIdx[i]];
    return { center: centers[i], r: p.r, g: p.g, b: p.b, x: p.x, y: p.y, count: counts[i] };
  });

  return finalizeClusters(raw, pixels, { minDelta, mergeDist, wantK: k });
}

// ---------- shared finalization ----------

/**
 * Выбор репрезентативного пикселя (медоида): реальный пиксель кластера,
 * ближайший к центру в OKLab. Ограничиваем перебор для скорости.
 */
export function pickMedoid(pixels, labs, memberIdx, center) {
  const cap = 1500;
  let idxs = memberIdx;
  if (memberIdx.length > cap) {
    const stride = memberIdx.length / cap;
    idxs = [];
    for (let i = 0; i < cap; i++) idxs.push(memberIdx[Math.floor(i * stride)]);
  }
  let best = pixels[memberIdx[0]];
  let bd = Infinity;
  for (const i of idxs) {
    const d = distLab(labs[i], center);
    if (d < bd) { bd = d; best = pixels[i]; }
  }
  return best;
}

/**
 * Слияние почти-дубликатов, спасение акцентов, нормализация долей (ровно 100.0%).
 */
export function finalizeClusters(raw, pixels, { minDelta, mergeDist, wantK }) {
  if (!raw.length) return [];

  // Сортировка по убыванию (стабильно): count, затем L для предсказуемости.
  raw.sort((a, b) => b.count - a.count || a.center.L - b.center.L);

  // Слияние дубликатов: меньший вливается в больший, центр — взвешенный.
  const merged = [];
  for (const c of raw) {
    let host = null;
    for (const m of merged) {
      if (oklabDistance(m.center, c.center) < mergeDist * 0.65) { host = m; break; }
    }
    if (host) {
      const t = host.count + c.count;
      host.center = {
        L: (host.center.L * host.count + c.center.L * c.count) / t,
        a: (host.center.a * host.count + c.center.a * c.count) / t,
        b: (host.center.b * host.count + c.center.b * c.count) / t
      };
      // Репрезентативный остаётся от большего (узнаваемость), count суммируется.
      host.count = t;
    } else {
      merged.push({ ...c });
    }
  }

  // Переназначение ВСЕХ пикселей выборки на ближайшие ИТОГОВЫЕ центры
  // и честный пересчёт долей (исправляет старый дефект count из кластеризации).
  const assignAll = (centers) => {
    const c = new Array(centers.length).fill(0);
    for (const p of pixels) {
      const lab = labOf(p);
      let best = 0, bd = Infinity;
      for (let k = 0; k < centers.length; k++) {
        const d = distLab(lab, centers[k].center);
        if (d < bd) { bd = d; best = k; }
      }
      c[best]++;
    }
    return c;
  };
  let counts = assignAll(merged);

  // Отсечение шумовых микрокластеров: одиночные пиксели-выбросы (например,
  // farthest-seed подхватил 1 неоновый пиксель) не должны становиться
  // отдельным цветом палитры. Порог: минимум max(5, 0.2% выборки).
  const tinyThreshold = Math.max(5, Math.floor(pixels.length * 0.002));
  let pruned = true;
  while (pruned && merged.length > 1) {
    pruned = false;
    let tinyIdx = -1;
    for (let i = 0; i < merged.length; i++) {
      if (counts[i] < tinyThreshold) { tinyIdx = i; break; }
    }
    if (tinyIdx === -1) break;
    // Вливаем в ближайший выживший кластер
    let near = -1, nearD = Infinity;
    for (let i = 0; i < merged.length; i++) {
      if (i === tinyIdx) continue;
      const d = oklabDistance(merged[tinyIdx].center, merged[i].center);
      if (d < nearD) { nearD = d; near = i; }
    }
    if (near === -1) break;
    counts[near] += counts[tinyIdx];
    merged.splice(tinyIdx, 1);
    counts.splice(tinyIdx, 1);
    pruned = true;
  }

  // Спасение малых акцентов (по пересчитанным долям): яркий далёкий цвет
  // площадью 0.3%..15% добавляем отдельным кластером, если есть место,
  // иначе — за счёт крошечного почти-дубликата. Прозрачная эвристика.
  rescueAccent(merged, pixels, mergeDist, wantK);
  counts = assignAll(merged);

  const total = pixels.length || 1;
  // Сырые доли + метод наибольших остатков до ровно 100.0% (1 знак).
  const rawPct = counts.map((c) => (c / total) * 100);
  const floored = rawPct.map((v) => Math.floor(v * 10) / 10);
  let remainder = Math.round((100 - floored.reduce((s, v) => s + v, 0)) * 10); // десятых
  const frac = rawPct.map((v, i) => ({ i, f: v * 10 - Math.floor(v * 10 + 1e-9) }));
  frac.sort((a, b) => b.f - a.f);
  const final10 = floored.map((v) => Math.round(v * 10));
  for (let k = 0; k < remainder && k < frac.length; k++) final10[frac[k].i] += 1;

  const items = merged.map((m, i) => ({
    id: makeId(),
    r: m.r, g: m.g, b: m.b,
    x: m.x, y: m.y,
    center: m.center,
    count: counts[i],
    percentage: final10[i] / 10
  }));

  // Сортировка по доле (стабильная), роли ниже назначает UI/логика.
  items.sort((a, b) => b.percentage - a.percentage || a.center.L - b.center.L);
  assignRoles(items, pixels);
  return items;
}

/**
 * Эвристика акцента: saturated (C>=0.07), далеко от доминант (>=0.13),
 * площадь в выборке 0.3%..15%, абсолютный минимум пикселей (защита от шума).
 * Не выдаём субъективную значимость за объективную: роль помечаем
 * как 'accent-candidate' с объяснением в UI.
 */
function rescueAccent(merged, pixels, mergeDist, wantK = 6) {
  if (!pixels.length || merged.length === 0) return;
  // Доминанты — два крупнейших
  const doms = [...merged].sort((a, b) => b.count - a.count).slice(0, 2).map((m) => m.center);

  // Гистограмма по квантованным ячейкам для поиска пропущенных акцентов
  const bins = new Map();
  for (const p of pixels) {
    const key = ((p.r >> 5) << 10) | ((p.g >> 5) << 5) | (p.b >> 5);
    let e = bins.get(key);
    if (!e) {
      const lab = labOf(p);
      e = { count: 0, lab, p };
      bins.set(key, e);
    }
    e.count++;
  }
  const n = pixels.length;
  let bestCand = null;
  let bestScore = 0;
  for (const e of bins.values()) {
    const share = e.count / n;
    if (share < 0.003 || share > 0.15) continue; // слишком мало (шум) / слишком много (не акцент)
    if (e.count < 6) continue;
    const C = Math.sqrt(e.lab.a * e.lab.a + e.lab.b * e.lab.b);
    if (C < 0.07) continue;
    let minDom = Infinity, minAll = Infinity;
    for (const d of doms) minDom = Math.min(minDom, oklabDistance(e.lab, d));
    for (const m of merged) minAll = Math.min(minAll, oklabDistance(e.lab, m.center));
    if (minDom < 0.13) continue;
    if (minAll < mergeDist * 0.65) continue; // уже представлен
    const score = C * minDom * Math.sqrt(share * 100);
    if (score > bestScore) { bestScore = score; bestCand = e; }
  }
  if (bestCand) {
    const fresh = {
      center: { ...bestCand.lab },
      r: bestCand.p.r, g: bestCand.p.g, b: bestCand.p.b,
      x: bestCand.p.x, y: bestCand.p.y,
      count: bestCand.count
    };
    if (merged.length < Math.max(1, wantK)) {
      // Есть место — добавляем, не разрушая палитру.
      merged.push(fresh);
      return;
    }
    // Места нет: заменяем наименьший кластер, только если он крошечный
    // либо почти-дубликат другого (не разрушаем палитру ради акцента).
    const sorted = [...merged].sort((a, b) => a.count - b.count);
    const smallest = sorted[0];
    const smallestShare = smallest.count / n;
    let isDup = false;
    for (const m of merged) {
      if (m !== smallest && oklabDistance(m.center, smallest.center) < mergeDist) { isDup = true; break; }
    }
    if (smallestShare < 0.015 || isDup) {
      const idx = merged.indexOf(smallest);
      merged[idx] = fresh;
    }
  }
}

/**
 * Роли: dominant (>=18% или топ-2 крупные), secondary (остальные средние),
 * accent (малые ≤8% + хроматичные + далёкие). Честные подписи без
 * утверждений о «визуальной значимости как факте».
 */
export function assignRoles(items, pixels) {
  for (const it of items) {
    it.role = 'secondary';
    it.roleNote = 'Второстепенный оттенок кадра';
  }
  if (!items.length) return;
  const sorted = [...items].sort((a, b) => b.percentage - a.percentage);
  const totalChromatic = items.filter((it) => {
    const lch = rgbToOklch(it);
    return lch.C >= 0.04;
  });

  sorted.forEach((it, idx) => {
    if (idx < 2 && it.percentage >= 12) {
      it.role = 'dominant';
      it.roleNote = 'Основной цвет фотографии (по площади)';
    }
  });
  // Акценты: малые, но хроматичные и далёкие от доминант
  const doms = sorted.filter((s) => s.role === 'dominant');
  for (const it of sorted) {
    if (it.role === 'dominant') continue;
    const lch = rgbToOklch(it);
    if (it.percentage <= 10 && lch.C >= 0.06) {
      let minD = Infinity;
      for (const d of doms) minD = Math.min(minD, oklabDistance(it.center, d.center));
      if (minD >= 0.12 || doms.length === 0) {
        it.role = 'accent';
        it.roleNote = 'Заметный цветовой акцент (насыщенный, небольшая площадь)';
      }
    }
  }
  void totalChromatic;
  void pixels;
}

/** Пересчёт долей после ручных правок (пин/удаление/добавление) — ровно 100.0%. */
export function recalculateShares(palette, pixels) {
  if (!palette.length || !pixels.length) return;
  for (const it of palette) it.count = 0;
  for (const p of pixels) {
    const lab = labOf(p);
    let best = 0, bd = Infinity;
    for (let c = 0; c < palette.length; c++) {
      const d = distLab(lab, palette[c].center || labOf(palette[c]));
      if (d < bd) { bd = d; best = c; }
    }
    palette[best].count++;
  }
  const total = pixels.length;
  const rawPct = palette.map((it) => (it.count / total) * 100);
  const floored = rawPct.map((v) => Math.floor(v * 10) / 10);
  let remainder = Math.round((100 - floored.reduce((s, v) => s + v, 0)) * 10);
  const frac = rawPct.map((v, i) => ({ i, f: v * 10 - Math.floor(v * 10 + 1e-9) }));
  frac.sort((a, b) => b.f - a.f);
  const final10 = floored.map((v) => Math.round(v * 10));
  for (let k = 0; k < remainder && k < frac.length; k++) final10[frac[k].i] += 1;
  palette.forEach((it, i) => { it.percentage = final10[i] / 10; });
  palette.sort((a, b) => b.percentage - a.percentage);
}

/** Единая точка входа для UI. algorithm: 'photo' | 'kmeans' | 'mediancut' | 'histogram'. */
export function analyzePixels(pixels, { algorithm = 'photo', colorCount = 6, minDelta = 28 } = {}) {
  const k = Math.max(1, Math.min(12, colorCount | 0));
  if (algorithm === 'mediancut') return extractMedianCut(pixels, k, minDelta);
  if (algorithm === 'histogram') return extractHistogramPeaks(pixels, k, minDelta);
  // 'photo' и 'kmeans': улучшенный детерминированный K-Means в OKLab
  return extractKMeans(pixels, k, minDelta);
}

/** Сортировки палитры (стабильные, активный цвет хранится по id снаружи). */
export function sortPaletteItems(items, sortBy) {
  const arr = [...items];
  if (sortBy === 'luminance') {
    arr.sort((a, b) => b.center.L - a.center.L);
  } else if (sortBy === 'hue') {
    const key = (it) => {
      const lch = rgbToOklch(it);
      if (lch.C < 0.02 || lch.H === null) return 1e9 + lch.L; // нейтрали в конец
      return lch.H;
    };
    arr.sort((a, b) => key(a) - key(b));
  } else {
    arr.sort((a, b) => b.percentage - a.percentage);
  }
  return arr;
}
