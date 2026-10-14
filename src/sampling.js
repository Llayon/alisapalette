/**
 * Сбалансированная стратифицированная выборка пикселей.
 * Вместо слепого роста разрешения: сетка + детерминированный джиттер,
 * плюс отдельная высокодетальная подсветка малых акцентов.
 */
import { rgbToOklab } from './color-science.js';

export const SAMPLE_TARGET = 9000;
export const SAMPLE_MAX_DIM = 200;

/**
 * Строит выборку из ImageData-подобного {width,height,data}.
 * Возвращает [{r,g,b,x,y,lab}] где x,y — нормализованные 0..1.
 * Детерминировано (без Math.random): джиттер через хэш координат ячейки.
 */
export function stratifiedSample(img, opts = {}) {
  const target = opts.target ?? SAMPLE_TARGET;
  const { width, height, data } = img;
  if (!width || !height || !data || !data.length) return [];

  const total = width * height;
  // Шаг сетки подбираем сразу под целевой объём (без промежуточного cap:
  // cap + прореживание давали пространственное смещение к верху кадра).
  const step = Math.max(1, Math.round(Math.sqrt(total / target)));
  const out = [];

  for (let gy = 0; gy < height; gy += step) {
    for (let gx = 0; gx < width; gx += step) {
      // детерминированный псевдоджиттер внутри ячейки
      const h = (gx * 73856093) ^ (gy * 19349663);
      const jx = step > 1 ? Math.abs(h % step) : 0;
      const jy = step > 1 ? Math.abs((h >> 7) % step) : 0;
      const x = Math.min(width - 1, gx + jx);
      const y = Math.min(height - 1, gy + jy);
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      out.push({
        r, g, b,
        x: (x + 0.5) / width,
        y: (y + 0.5) / height,
        lab: rgbToOklab({ r, g, b })
      });
    }
  }

  // Страховка: равномерное прореживание ПОЛНОГО кадра (несмещённое).
  if (out.length > target) {
    const stride = out.length / target;
    const thinned = [];
    for (let i = 0; i < target; i++) thinned.push(out[Math.floor(i * stride)]);
    return thinned;
  }
  return out;
}

/**
 * Подсветка малых деталей: выбирает до `budget` пикселей с высокой chroma,
 * далёких от уже покрытых — помогает не потерять помаду/сумку/цветок.
 * Возвращает индексы-кандидаты (пиксели из полной мелкой сетки).
 */
export function accentCandidates(img, coverLabs, budget = 400) {
  const { width, height, data } = img;
  if (!width || !height) return [];
  const step = Math.max(1, Math.floor(Math.max(width, height) / 220));
  const cands = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lab = rgbToOklab({ r, g, b });
      const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
      if (C < 0.06) continue; // только заметно chromatic
      let minD = Infinity;
      for (const cl of coverLabs) {
        const dL = lab.L - cl.L, da = lab.a - cl.a, db = lab.b - cl.b;
        const d = Math.sqrt(dL * dL + da * da + db * db);
        if (d < minD) minD = d;
      }
      if (minD > 0.12) {
        cands.push({ r, g, b, x: (x + 0.5) / width, y: (y + 0.5) / height, lab, score: C * minD });
      }
    }
  }
  cands.sort((a, b) => b.score - a.score);
  return cands.slice(0, budget);
}

/** Рисует source canvas/image в analysis canvas не больше maxDim с сохранением пропорций. */
export function drawToAnalysis(sourceCanvas, analysisCanvas, maxDim = SAMPLE_MAX_DIM) {
  const w = sourceCanvas.width, h = sourceCanvas.height;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const sw = Math.max(1, Math.round(w * scale));
  const sh = Math.max(1, Math.round(h * scale));
  analysisCanvas.width = sw;
  analysisCanvas.height = sh;
  const actx = analysisCanvas.getContext('2d', { willReadFrequently: true });
  actx.drawImage(sourceCanvas, 0, 0, sw, sh);
  return actx.getImageData(0, 0, sw, sh);
}
