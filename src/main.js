/** Точка входа: загрузка фото -> выборка -> кластеризация -> доли -> рендер. */
import './styles.css';
import { state, selectedColor, setSelected, resetPhotoState, MAX_PINS } from './state.js';
import { stratifiedSample, drawToAnalysis, SAMPLE_MAX_DIM } from './sampling.js';
import { analyzePixels, recalculateShares, sortPaletteItems, resetIdCounter } from './palette.js';
import { rgbToHex, textOnColor } from './color-science.js';
import { getPoeticColorName } from './poetic.js';
import { renderPins, renderProportion, renderPaletteCards, renderHarmony, renderPerfume, renderProducts, formatColorValue, esc } from './ui.js';

const $ = (id) => document.getElementById(id);

const mainCanvas = $('mainCanvas');
const ctx = mainCanvas.getContext('2d', { willReadFrequently: true });
const analysisCanvas = document.createElement('canvas');
const pinsLayer = $('pinsLayer');

let pinBackup = null;
let debounceTimer = null;
function debounce(fn, ms = 180) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fn, ms);
}

// ---------- toast + haptics ----------

const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
try { tg && tg.ready && tg.ready(); tg && tg.expand && tg.expand(); } catch { /* noop */ }

function haptic(type = 'light') {
  try {
    if (tg && tg.HapticFeedback) {
      if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
      else tg.HapticFeedback.impactOccurred(type);
    } else if (navigator.vibrate) navigator.vibrate(type === 'success' ? [12, 30, 12] : 8);
  } catch { /* noop */ }
}

export function copyToClipboard(text, previewHex = '#f43f5e', label = null) {
  haptic('success');
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else fallbackCopy(text);
  } catch { fallbackCopy(text); }
  const toast = $('toast');
  $('toastSwatch').style.backgroundColor = previewHex;
  $('toastText').textContent = label ? `${label}: ${text}` : `Скопировано: ${text}`;
  toast.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch { /* noop */ }
  document.body.removeChild(ta);
}
window.copyToClipboard = copyToClipboard;
// Отладочный доступ к состоянию для E2E/диагностики (только чтение в тестах).
window.__chromastyle = state;

// ---------- pipette ----------

export function sampleCanvasColor(px, py, kernelSize = state.kernelSize) {
  const width = mainCanvas.width, height = mainCanvas.height;
  const cx = Math.min(width - 1, Math.max(0, Math.floor(px)));
  const cy = Math.min(height - 1, Math.max(0, Math.floor(py)));
  if (kernelSize <= 1) {
    const d = ctx.getImageData(cx, cy, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  }
  const radius = Math.floor(kernelSize / 2);
  const x0 = Math.max(0, cx - radius), y0 = Math.max(0, cy - radius);
  const x1 = Math.min(width - 1, cx + radius), y1 = Math.min(height - 1, cy + radius);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const data = ctx.getImageData(x0, y0, w, h).data;
  let rS = 0, gS = 0, bS = 0, wS = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 128) continue;
      const isCenter = (x0 + x === cx) && (y0 + y === cy);
      const wgt = isCenter ? 2 : 1;
      rS += data[i] * wgt; gS += data[i + 1] * wgt; bS += data[i + 2] * wgt;
      wS += wgt;
    }
  }
  if (!wS) {
    const d = ctx.getImageData(cx, cy, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  }
  return { r: Math.round(rS / wS), g: Math.round(gS / wS), b: Math.round(bS / wS) };
}

// ---------- main pipeline ----------

export function analyzeImagePalette() {
  const t0 = performance.now();
  const width = mainCanvas.width, height = mainCanvas.height;
  if (!width || !height) return;

  const tSample0 = performance.now();
  const imgData = drawToAnalysis(mainCanvas, analysisCanvas, SAMPLE_MAX_DIM);
  const pixels = stratifiedSample({ width: imgData.width, height: imgData.height, data: imgData.data });
  state.sampledPixels = pixels;
  state.timings.sample = Math.round(performance.now() - tSample0);

  const tCluster0 = performance.now();
  resetIdCounter();
  const extracted = analyzePixels(pixels, { algorithm: state.algorithm, colorCount: state.colorCount, minDelta: state.minDelta });
  state.timings.cluster = Math.round(performance.now() - tCluster0);

  // Масштабируем нормализованные координаты на полный canvas для пинов.
  state.palette = extracted;
  // Активный цвет: первый по доле (id, не индекс — переживает сортировку).
  if (state.palette.length) setSelected(state.palette[0].id);

  applySort(false);
  const elapsed = Math.round(performance.now() - t0);
  $('processingTime').textContent = `${elapsed} мс • локально, без ИИ`;
  $('timingsLine').textContent = `выборка ${state.timings.sample} мс · кластеры ${state.timings.cluster} мс · гармонии ${state.timings.harmony} мс · точек ${pixels.length}`;
  renderAll();
}

function applySort(rerender = true) {
  const sel = selectedColor();
  const selId = sel ? sel.id : null;
  state.palette = sortPaletteItems(state.palette, state.sortBy);
  if (selId) setSelected(selId);
  else if (state.palette.length) setSelected(state.palette[0].id);
  if (rerender) renderAll();
}

export function renderAll() {
  renderPins(pinsLayer, mainCanvas, {
    onPinDown: (e, item, index, pin) => {
      e.stopPropagation();
      e.preventDefault();
      state.draggingPinId = item.id;
      pinBackup = { x: item.x, y: item.y, r: item.r, g: item.g, b: item.b };
      setSelected(item.id);
      haptic('light');
      try { pin.setPointerCapture(e.pointerId); } catch { /* noop */ }
    },
    onPinMove: (e, item) => {
      if (state.draggingPinId !== item.id) return;
      e.stopPropagation();
      e.preventDefault();
      movePinToClientPos(item, e.clientX, e.clientY);
    },
    onPinUp: (e, item) => {
      if (state.draggingPinId === item.id) {
        state.draggingPinId = null;
        pinBackup = null;
        haptic('light');
        renderAll();
      }
    },
    onPinCancel: (e, item) => {
      // Восстановление после отмены перетаскивания.
      if (pinBackup && state.draggingPinId === item.id) {
        Object.assign(item, pinBackup);
        recalculateShares(state.palette, state.sampledPixels);
      }
      state.draggingPinId = null;
      pinBackup = null;
      renderAll();
    }
  });
  renderProportion($('proportionBar'), $('proportionLegend'), $('rule603010Grid'), $('stylistVerdictBadge'), (id) => {
    setSelected(id);
    renderAll();
  });
  renderPaletteCards($('paletteList'),
    (id) => { setSelected(id); haptic('light'); renderAll(); },
    (item) => copyToClipboard(formatColorValue(item), rgbToHex(item.r, item.g, item.b), getPoeticColorName(item.r, item.g, item.b)),
    (id) => {
      state.palette = state.palette.filter((c) => c.id !== id);
      recalculateShares(state.palette, state.sampledPixels);
      if (!state.palette.find((c) => c.id === state.selectedColorId) && state.palette.length) {
        setSelected(state.palette[0].id);
      }
      renderAll();
    });
  renderHarmony($('harmonyContainer'),
    (hex, name) => copyToClipboard(hex, hex, name),
    (combo) => copyToClipboard(combo.swatches.map((s) => `${s.name} ${s.hex}`).join(' · '), combo.swatches[0].hex, combo.title));
  renderPerfume($('olfactoryHeaderBanner'), $('olfactoryPyramidGrid'), $('weatherAdviceText'), $('matchedPerfumesGrid'), $('perfumeRadarCanvas'));
  renderProducts($('matchedProductsGrid'), (sku, hex, title) => copyToClipboard(sku, hex, title));
  const t = $('timingsLine');
  if (t && state.timings.harmony) {
    const m = t.textContent.match(/точек \d+/) || [''];
    t.textContent = `выборка ${state.timings.sample} мс · кластеры ${state.timings.cluster} мс · гармонии ${state.timings.harmony} мс · ${m[0]}`;
  }
}

export function movePinToClientPos(item, clientX, clientY) {
  const rect = mainCanvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return;
  // Корректные координаты при CSS-масштабировании + кламп у краёв.
  const normX = Math.min(0.995, Math.max(0.005, (clientX - rect.left) / rect.width));
  const normY = Math.min(0.995, Math.max(0.005, (clientY - rect.top) / rect.height));
  item.x = normX;
  item.y = normY;
  const px = Math.min(mainCanvas.width - 1, Math.max(0, Math.floor(normX * mainCanvas.width)));
  const py = Math.min(mainCanvas.height - 1, Math.max(0, Math.floor(normY * mainCanvas.height)));
  const s = sampleCanvasColor(px, py);
  item.r = s.r; item.g = s.g; item.b = s.b;
  // Центр кластера = новый замер (пин — измерение области), доля пересчитывается.
  // Чтобы один пин не разрушал всю палитру: меняем только его центр.
  item.center = undefined; // recalculateShares использует display-цвет как центр пина
  recalculateShares(state.palette, state.sampledPixels);
  const pinEl = pinsLayer.querySelector(`[data-id="${item.id}"]`);
  if (pinEl) {
    const hex = rgbToHex(item.r, item.g, item.b);
    pinEl.style.left = `${normX * 100}%`;
    pinEl.style.top = `${normY * 100}%`;
    pinEl.style.backgroundColor = hex;
    pinEl.style.color = textOnColor(item);
  }
  // Лёгкий рендер без полного анализа фото.
  renderProportion($('proportionBar'), $('proportionLegend'), $('rule603010Grid'), $('stylistVerdictBadge'), (id) => { setSelected(id); renderAll(); });
  renderPaletteCards($('paletteList'),
    (id) => { setSelected(id); renderAll(); },
    (it) => copyToClipboard(formatColorValue(it), rgbToHex(it.r, it.g, it.b), getPoeticColorName(it.r, it.g, it.b)),
    (id) => { state.palette = state.palette.filter((c) => c.id !== id); recalculateShares(state.palette, state.sampledPixels); renderAll(); });
  renderHarmony($('harmonyContainer'),
    (hex, name) => copyToClipboard(hex, hex, name),
    (combo) => copyToClipboard(combo.swatches.map((s) => `${s.name} ${s.hex}`).join(' · '), combo.swatches[0].hex, combo.title));
}

// Клик по фото = новый пользовательский пин (лимит MAX_PINS).
mainCanvas.addEventListener('click', (e) => {
  if (state.draggingPinId) return;
  if (state.palette.length >= MAX_PINS) {
    copyToClipboard(`Лимит ${MAX_PINS} точек`, '#f43f5e', 'Достигнут лимит пинов');
    return;
  }
  const rect = mainCanvas.getBoundingClientRect();
  const normX = Math.min(0.995, Math.max(0.005, (e.clientX - rect.left) / rect.width));
  const normY = Math.min(0.995, Math.max(0.005, (e.clientY - rect.top) / rect.height));
  const px = Math.floor(normX * mainCanvas.width);
  const py = Math.floor(normY * mainCanvas.height);
  const s = sampleCanvasColor(px, py);
  const { makeId } = require_makeId();
  const item = { r: s.r, g: s.g, b: s.b, x: normX, y: normY, count: 0, percentage: 0, id: makeId('pin-custom'), role: 'secondary', roleNote: 'Точка пользователя (измерение области)' };
  state.palette.push(item);
  setSelected(item.id);
  recalculateShares(state.palette, state.sampledPixels);
  renderAll();
  copyToClipboard(formatColorValue(item), rgbToHex(item.r, item.g, item.b), getPoeticColorName(item.r, item.g, item.b));
});
import { makeId as _makeId } from './palette.js';
function require_makeId() { return { makeId: _makeId }; }

// ---------- загрузка фото (JPEG/PNG/WebP, ориентация, ошибки) ----------

async function decodeFile(file) {
  const t0 = performance.now();
  try {
    if ('createImageBitmap' in window) {
      try {
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
        state.timings.decode = Math.round(performance.now() - t0);
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
      state.timings.decode = Math.round(performance.now() - t0);
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    state.timings.decode = Math.round(performance.now() - t0);
    throw new Error('decode');
  }
}

export async function handleImageFile(file) {
  const errBox = $('loadError');
  errBox.hidden = true;
  if (!file) return;
  if (!file.type || !file.type.startsWith('image/')) {
    errBox.hidden = false;
    errBox.textContent = 'Нужен файл-картинка: JPEG, PNG или WebP.';
    return;
  }
  try {
    const bmp = await decodeFile(file);
    const natW = bmp.width, natH = bmp.height;
    const maxDim = 1400;
    let w = natW, h = natH;
    if (w > maxDim || h > maxDim) {
      const ratio = Math.min(maxDim / w, maxDim / h);
      w = Math.round(w * ratio); h = Math.round(h * ratio);
    }
    resetPhotoState(); // сброс устаревших данных ДО нового анализа
    mainCanvas.width = w; mainCanvas.height = h;
    ctx.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) { try { bmp.close(); } catch { /* noop */ } }
    $('imageDimensions').textContent = `${natW} × ${natH} px`;
    haptic('success');
    analyzeImagePalette();
  } catch {
    errBox.hidden = false;
    errBox.textContent = 'Не получилось прочитать изображение. Попробуйте другой файл (JPEG/PNG/WebP).';
  }
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
  const w = 800, h = 600;
  resetPhotoState();
  mainCanvas.width = w; mainCanvas.height = h;
  $('imageDimensions').textContent = `${w} × ${h} px`;
  if (type === 'coffee') {
    ctx.fillStyle = '#EAE0D2'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#D8C6B4';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.65, 0); ctx.lineTo(w * 0.25, h); ctx.lineTo(0, h); ctx.fill();
    ctx.fillStyle = '#F8F1E5'; ctx.beginPath(); ctx.arc(w * 0.36, h * 0.56, 150, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#C6864E'; ctx.beginPath(); ctx.ellipse(w * 0.36, h * 0.55, 95, 52, -0.25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9C623E'; ctx.beginPath(); ctx.ellipse(w * 0.36, h * 0.55, 65, 32, -0.25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3E2920'; ctx.beginPath(); ctx.arc(w * 0.7, h * 0.42, 95, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#AF8A6C'; ctx.beginPath(); ctx.arc(w * 0.7, h * 0.42, 78, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F8F1E5'; ctx.beginPath(); ctx.arc(w * 0.7, h * 0.40, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8EA592';
    ctx.beginPath(); ctx.ellipse(w * 0.22, h * 0.22, 48, 24, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * 0.31, h * 0.18, 42, 22, -0.3, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'ootd') {
    // Гардероб: деним + кашемир + бордовый аксессуар
    ctx.fillStyle = '#F5F5F4'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#BDA285'; ctx.fillRect(40, 40, 360, 520);
    ctx.fillStyle = '#F8F1E5'; ctx.fillRect(280, 70, 240, 260);
    ctx.fillStyle = '#4A7098'; ctx.fillRect(430, 250, 320, 310);
    ctx.fillStyle = '#621626';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(240, 360, 190, 140, 28); else ctx.rect(240, 360, 190, 140);
    ctx.fill();
  } else if (type === 'flowers') {
    // Розовые пионы + приглушённая зелень
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#F4DBD8'); bg.addColorStop(1, '#EAE0D2');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#E8A5B2'; ctx.beginPath(); ctx.arc(w * 0.38, h * 0.45, 130, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#C48A91'; ctx.beginPath(); ctx.arc(w * 0.58, h * 0.38, 105, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8A1C30'; ctx.beginPath(); ctx.arc(w * 0.48, h * 0.68, 65, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8EA592'; ctx.fillRect(w * 0.15, h * 0.65, 160, 95);
  } else if (type === 'gray') {
    // Почти полностью серое (для проверки нейтралей)
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#cfcfcf'); g.addColorStop(0.5, '#b9b9bb'); g.addColorStop(1, '#8f9092');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#6f7072'; ctx.fillRect(w * 0.4, h * 0.35, w * 0.2, h * 0.3);
  } else {
    // Уютный дом: молочно-бежевый интерьер + оливковые детали
    ctx.fillStyle = '#F8F1E5'; ctx.fillRect(0, 0, w, h * 0.68);
    ctx.fillStyle = '#764E38'; ctx.fillRect(0, h * 0.68, w, h * 0.32);
    ctx.fillStyle = '#76804E';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(70, h * 0.38, 380, 240, 24); else ctx.rect(70, h * 0.38, 380, 240);
    ctx.fill();
    ctx.fillStyle = '#C26248'; ctx.beginPath(); ctx.arc(w * 0.74, h * 0.54, 98, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#A4C6E4';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(140, h * 0.42, 145, 135, 20); else ctx.rect(140, h * 0.42, 145, 135);
    ctx.fill();
  }
  analyzeImagePalette();
};

// ---------- контролы ----------

document.querySelectorAll('[data-algo]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.algorithm = btn.dataset.algo;
    haptic('light');
    document.querySelectorAll('[data-algo]').forEach((b) => b.classList.toggle('on', b.dataset.algo === state.algorithm));
    analyzeImagePalette();
  });
});

$('colorCountSlider').addEventListener('input', (e) => {
  state.colorCount = parseInt(e.target.value, 10);
  $('colorCountValue').textContent = state.colorCount;
  debounce(() => analyzeImagePalette());
});
$('deltaSlider').addEventListener('input', (e) => {
  state.minDelta = parseInt(e.target.value, 10);
  $('deltaValue').textContent = state.minDelta;
  debounce(() => analyzeImagePalette());
});
$('sortSelect').addEventListener('change', (e) => {
  state.sortBy = e.target.value;
  applySort(true);
});
document.querySelectorAll('[data-format]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.activeFormat = btn.dataset.format;
    document.querySelectorAll('[data-format]').forEach((b) => b.classList.toggle('on', b.dataset.format === state.activeFormat));
    renderAll();
  });
});
document.querySelectorAll('[data-kernel]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.kernelSize = parseInt(btn.dataset.kernel, 10);
    haptic('light');
    document.querySelectorAll('[data-kernel]').forEach((b) => b.classList.toggle('on', parseInt(b.dataset.kernel, 10) === state.kernelSize));
  });
});
$('togglePinsCheckbox').addEventListener('change', (e) => {
  state.showPins = e.target.checked;
  renderAll();
});
$('addCustomPinBtn').addEventListener('click', () => {
  if (state.palette.length >= MAX_PINS) {
    copyToClipboard(`Лимит ${MAX_PINS} точек`, '#f43f5e', 'Достигнут лимит пинов');
    return;
  }
  const normX = 0.3, normY = 0.4;
  const s = sampleCanvasColor(normX * mainCanvas.width, normY * mainCanvas.height);
  state.palette.push({ r: s.r, g: s.g, b: s.b, x: normX, y: normY, count: 0, percentage: 0, id: _makeId('pin-custom'), role: 'secondary', roleNote: 'Точка пользователя' });
  recalculateShares(state.palette, state.sampledPixels);
  renderAll();
});
$('recalculateBtn').addEventListener('click', () => { haptic('light'); analyzeImagePalette(); });
$('copyAllHexBtn').addEventListener('click', () => {
  const all = state.palette.map((c) => `${getPoeticColorName(c.r, c.g, c.b)} (${rgbToHex(c.r, c.g, c.b)})`).join(', ');
  copyToClipboard(all || '—', state.palette.length ? rgbToHex(state.palette[0].r, state.palette[0].g, state.palette[0].b) : '#f43f5e', 'Вся палитра скопирована');
});
$('weatherTempSlider').addEventListener('input', (e) => {
  state.weatherTemp = parseInt(e.target.value, 10);
  $('weatherTempLabel').textContent = `${state.weatherTemp > 0 ? '+' : ''}${state.weatherTemp}°C`;
  debounce(() => renderAll(), 120);
});
document.querySelectorAll('[data-occasion]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.occasion = btn.dataset.occasion;
    document.querySelectorAll('[data-occasion]').forEach((b) => b.classList.toggle('on', b.dataset.occasion === state.occasion));
    renderAll();
  });
});
$('bloggerPromoInput').addEventListener('input', (e) => { state.bloggerPromo = e.target.value.trim() || 'БЛОГ10'; });
$('blogHandleInput').addEventListener('input', (e) => {
  state.blogHandle = e.target.value || '@my_lifestyle_blog';
  $('storyHandleModalInput').value = state.blogHandle;
});
$('storyHandleModalInput').addEventListener('input', (e) => {
  state.blogHandle = e.target.value || '@my_lifestyle_blog';
  $('blogHandleInput').value = state.blogHandle;
  renderExportStoryCard();
});
$('storyTitleInput').addEventListener('input', (e) => {
  state.storyTitle = e.target.value || 'Палитра моего дня';
  renderExportStoryCard();
});

// ---------- экспорт Stories 9:16 ----------

const exportModal = $('exportModal');
const exportCardCanvas = $('exportCardCanvas');
const exportCodeArea = $('exportCodeArea');

function renderExportStoryCard() {
  const W = 720, H = 1280;
  exportCardCanvas.width = W; exportCardCanvas.height = H;
  const c = exportCardCanvas.getContext('2d');
  const tpl = state.storyTemplate;
  const isDark = tpl === 'editorial';
  c.fillStyle = isDark ? '#0c0a09' : (tpl === 'polaroid' ? '#EFECE6' : '#FAF6F0');
  c.fillRect(0, 0, W, H);
  if (state.palette.length) {
    const top = state.palette[0];
    const grad = c.createRadialGradient(W * 0.5, H * 0.25, 40, W * 0.5, H * 0.25, 520);
    grad.addColorStop(0, `rgba(${top.r}, ${top.g}, ${top.b}, ${isDark ? 0.22 : 0.16})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);
  }
  c.textAlign = 'center';
  c.fillStyle = isDark ? '#FAFAF9' : '#1C1917';
  c.font = 'bold 34px Inter, sans-serif';
  c.fillText(state.storyTitle.slice(0, 40), W / 2, 78);
  c.fillStyle = isDark ? '#A8A29E' : '#78716C';
  c.font = '500 17px Inter, sans-serif';
  c.fillText('ПАЛИТРА КАДРА · CHROMASTYLE', W / 2, 112);
  const pad = 48;
  const photoBoxW = W - pad * 2;
  const photoBoxH = 510;
  const photoY = 142;
  c.save();
  c.beginPath();
  if (c.roundRect) c.roundRect(pad, photoY, photoBoxW, photoBoxH, 24); else c.rect(pad, photoY, photoBoxW, photoBoxH);
  c.clip();
  if (mainCanvas.width && mainCanvas.height) {
    const imgRatio = mainCanvas.width / mainCanvas.height;
    const boxRatio = photoBoxW / photoBoxH;
    let dw = photoBoxW, dh = photoBoxH, dx = pad, dy = photoY;
    if (imgRatio > boxRatio) { dw = photoBoxH * imgRatio; dx = pad - (dw - photoBoxW) / 2; }
    else { dh = photoBoxW / imgRatio; dy = photoY - (dh - photoBoxH) / 2; }
    c.drawImage(mainCanvas, dx, dy, dw, dh);
  }
  c.restore();
  const listStartY = photoY + photoBoxH + 38;
  const maxColors = Math.min(state.palette.length, 6);
  for (let i = 0; i < maxColors; i++) {
    const item = state.palette[i];
    const hex = rgbToHex(item.r, item.g, item.b);
    const poetic = getPoeticColorName(item.r, item.g, item.b);
    const y = listStartY + i * 76;
    c.fillStyle = isDark ? '#1C1917' : '#FFFFFF';
    c.beginPath();
    if (c.roundRect) c.roundRect(pad, y, photoBoxW, 62, 16); else c.rect(pad, y, photoBoxW, 62);
    c.fill();
    c.fillStyle = hex;
    c.beginPath(); c.arc(pad + 34, y + 31, 20, 0, Math.PI * 2); c.fill();
    c.textAlign = 'left';
    c.fillStyle = isDark ? '#F5F5F4' : '#1C1917';
    c.font = 'bold 21px Inter, sans-serif';
    c.fillText(poetic.slice(0, 28), pad + 68, y + 29);
    c.fillStyle = isDark ? '#A8A29E' : '#78716C';
    c.font = '500 15px monospace';
    c.fillText(hex, pad + 68, y + 50);
    c.textAlign = 'right';
    c.fillStyle = isDark ? '#FB7185' : '#E11D48';
    c.font = 'bold 19px monospace';
    c.fillText(`${item.percentage.toFixed(1)}%`, W - pad - 20, y + 38);
  }
  c.textAlign = 'center';
  c.fillStyle = isDark ? '#F43F5E' : '#E11D48';
  c.font = 'bold 22px Inter, sans-serif';
  c.fillText(`Палитра собрана в ${state.blogHandle}`.slice(0, 42), W / 2, H - 56);
  c.fillStyle = isDark ? '#78716C' : '#A8A29E';
  c.font = '500 14px Inter, sans-serif';
  c.fillText('ChromaStyle · локально в браузере, без сервера', W / 2, H - 32);
}

function generateExportCode() {
  if (state.activeCodeTab === 'json') {
    exportCodeArea.value = JSON.stringify(state.palette.map((c, i) => ({
      index: i + 1, poeticName: getPoeticColorName(c.r, c.g, c.b), hex: rgbToHex(c.r, c.g, c.b), percentage: c.percentage
    })), null, 2);
  } else if (state.activeCodeTab === 'tailwind') {
    const lines = ['// tailwind.config.js', 'colors: {', '  lifestyle: {'];
    state.palette.forEach((c, i) => lines.push(`    '${(i + 1) * 100}': '${rgbToHex(c.r, c.g, c.b)}', // ${getPoeticColorName(c.r, c.g, c.b)}`));
    lines.push('  }', '}');
    exportCodeArea.value = lines.join('\n');
  } else {
    const lines = [':root {'];
    state.palette.forEach((c, i) => lines.push(`  --color-${i + 1}: ${rgbToHex(c.r, c.g, c.b)}; /* ${c.percentage.toFixed(1)}% — ${getPoeticColorName(c.r, c.g, c.b)} */`));
    lines.push('}');
    exportCodeArea.value = lines.join('\n');
  }
}

$('openStoriesModalBtn').addEventListener('click', () => {
  haptic('light');
  generateExportCode();
  renderExportStoryCard();
  exportModal.classList.remove('hidden');
});
$('closeExportBtn').addEventListener('click', () => exportModal.classList.add('hidden'));
exportModal.addEventListener('click', (e) => { if (e.target === exportModal) exportModal.classList.add('hidden'); });
document.querySelectorAll('[data-template]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.storyTemplate = btn.dataset.template;
    document.querySelectorAll('[data-template]').forEach((b) => b.classList.toggle('on', b.dataset.template === state.storyTemplate));
    renderExportStoryCard();
  });
});
document.querySelectorAll('[data-code]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.activeCodeTab = btn.dataset.code;
    document.querySelectorAll('[data-code]').forEach((b) => b.classList.toggle('on', b.dataset.code === state.activeCodeTab));
    generateExportCode();
  });
});
$('copyExportCodeBtn').addEventListener('click', () => copyToClipboard(exportCodeArea.value, '#f43f5e', 'Код скопирован'));
$('shareOrDownloadStoryBtn').addEventListener('click', async () => {
  haptic('success');
  exportCardCanvas.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], `story-palette-${Date.now()}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: state.storyTitle, text: `Палитра собрана в ${state.blogHandle}` });
        return;
      } catch { /* fallback */ }
    }
    const link = document.createElement('a');
    link.download = `chromastyle-story-9x16-${Date.now()}.png`;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  }, 'image/png');
});

// ---------- init ----------

window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-algo]').forEach((b) => b.classList.toggle('on', b.dataset.algo === state.algorithm));
  loadPresetSample('interior');
});
