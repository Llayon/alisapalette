import { $ } from './dom.js';
import { state, setSelected, resetPhotoState } from './state.js';
import { stratifiedSample, drawToAnalysis, SAMPLE_MAX_DIM } from './sampling.js';
import { analyzePixels } from './palette.js';
import { createPhotoLoader } from './photo-loader.js';
import { createDemoScene } from './demo-scenes.js';

export function createPhotoController({ mainCanvas, palette, storyStudio, haptic }) {
  const ctx = mainCanvas.getContext('2d', { willReadFrequently: true });
  const analysisCanvas = document.createElement('canvas');

  function preparePhotoAnalysis(source) {
    const t0 = performance.now();
    const width = source.width, height = source.height;
    if (!width || !height) return;

    const tSample0 = performance.now();
    const imgData = drawToAnalysis(source, analysisCanvas, SAMPLE_MAX_DIM);
    const pixels = stratifiedSample({ width: imgData.width, height: imgData.height, data: imgData.data });
    const sample = Math.round(performance.now() - tSample0);

    const tCluster0 = performance.now();
    const extracted = analyzePixels(pixels, { algorithm: state.algorithm, colorCount: state.colorCount, minDelta: state.minDelta });
    const cluster = Math.round(performance.now() - tCluster0);

    return { palette: extracted, pixels, timings: { sample, cluster }, elapsed: Math.round(performance.now() - t0) };
  }

  function applyPhotoAnalysis(result) {
    // Масштабируем нормализованные координаты на полный canvas для пинов.
    state.palette = result.palette;
    state.sampledPixels = result.pixels;
    Object.assign(state.timings, result.timings);
    // Активный цвет: первый по доле (id, не индекс — переживает сортировку).
    if (state.palette.length) setSelected(state.palette[0].id);

    palette.applySort(false);
    const elapsed = result.elapsed;
    $('processingTime').textContent = `${elapsed} мс • локально, без ИИ`;
    $('timingsLine').textContent = `выборка ${state.timings.sample} мс · кластеры ${state.timings.cluster} мс · гармонии ${state.timings.harmony} мс · точек ${result.pixels.length}`;
    palette.renderAll();
  }

  function analyzeImagePalette() {
    const result = preparePhotoAnalysis(mainCanvas);
    if (result) applyPhotoAnalysis(result);
  }

  function updatePhotoBadge() {
    const badge = $('photoBadge');
    if (!badge) return;
    if (state.isDemo) {
      badge.textContent = state.photoLabel || 'Демонстрационный пример';
      badge.classList.add('demo');
    } else {
      badge.textContent = state.photoLabel || 'Ваше фото';
      badge.classList.remove('demo');
    }
  }

  async function decodeFile(file) {
    try {
      if ('createImageBitmap' in window) {
        try {
          const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
          return bmp;
        } catch { /* fallback ниже */ }
      }
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = () => reject(new Error('decode'));
          im.src = url;
        });
        return img;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      throw new Error('decode');
    }
  }

  function commitPhoto(prepared, { isDemo, label, dimensions, decodeMs = 0 }) {
    const result = preparePhotoAnalysis(prepared);
    storyStudio.beforePhotoChange();
    mainCanvas.width = prepared.width; mainCanvas.height = prepared.height;
    ctx.drawImage(prepared, 0, 0);
    resetPhotoState();
    storyStudio.resetForPhoto();
    state.timings.decode = decodeMs;
    state.isDemo = isDemo;
    state.photoLabel = label;
    updatePhotoBadge();
    $('imageDimensions').textContent = dimensions;
    applyPhotoAnalysis(result);
    storyStudio.afterPhotoChange();
    if (!isDemo) haptic('success');
  }

  const photoLoader = createPhotoLoader({
    decode: decodeFile,
    commit(bmp, file, decodeMs) {
      const natW = bmp.width, natH = bmp.height;
      if (!natW || !natH) throw new Error('empty-image');
      const ratio = Math.min(1, 1400 / Math.max(natW, natH));
      const w = Math.max(1, Math.round(natW * ratio));
      const h = Math.max(1, Math.round(natH * ratio));
      const prepared = document.createElement('canvas');
      prepared.width = w; prepared.height = h;
      prepared.getContext('2d').drawImage(bmp, 0, 0, w, h);
      commitPhoto(prepared, { isDemo: false, label: file.name || 'Ваше фото', dimensions: natW + ' \u00d7 ' + natH + ' px', decodeMs });
    },
    onError() {
      $('loadError').hidden = false;
      $('loadError').textContent = 'Не получилось прочитать изображение. Попробуйте другой файл (JPEG/PNG/WebP).';
    }
  });

  async function handleImageFile(file) {
    if (!file) return;
    photoLoader.invalidate();
    const errBox = $('loadError');
    errBox.hidden = true;
    if (!file.type || !file.type.startsWith('image/')) {
      errBox.hidden = false;
      errBox.textContent = 'Нужен файл-картинка: JPEG, PNG или WebP.';
      return;
    }
    await photoLoader.load(file);
  }

  $('fileInput').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) handleImageFile(e.target.files[0]);
    e.target.value = '';
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleImageFile(e.dataTransfer.files[0]);
  });
  window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || {}).items || [];
    for (const item of items) {
      if (item.type && item.type.indexOf('image') === 0) {
        handleImageFile(item.getAsFile());
        break;
      }
    }
  });

  // ---------- демо-сцены (процедурные, детерминированные) ----------

  window.loadPresetSample = function (type) {
    photoLoader.invalidate();
    $('loadError').hidden = true;
    const { canvas, label } = createDemoScene(type);
    commitPhoto(canvas, { isDemo: true, label, dimensions: canvas.width + ' \u00d7 ' + canvas.height + ' px' });
  };

  // Главный CTA и hero-кнопка открывают выбор файла (нативная кнопка — доступна с клавиатуры).
  for (const id of ['topPickBtn', 'heroPickBtn', 'changePhotoBtn']) {
    const btn = $(id);
    if (btn) btn.addEventListener('click', () => { haptic('light'); $('fileInput').click(); });
  }
  // Демонстрационные примеры hero (делегирование вместо inline onclick).
  document.querySelector('.hero-examples').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-preset]');
    if (!chip) return;
    haptic('light');
    window.loadPresetSample(chip.dataset.preset);
    document.querySelector('.flow-photo').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  return { analyzeImagePalette, handleImageFile };
}
