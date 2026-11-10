import { $, setToggleGroup, createDebounce } from './dom.js';
import { showToast } from './notifications.js';
import { state, selectedColor, setSelected, MAX_PINS } from './state.js';
import { recalculateShares, sortPaletteItems, makeId } from './palette.js';
import { rgbToHex, textOnColor } from './color-science.js';
import { getPoeticColorName } from './poetic.js';
import { renderPins, renderProportion, renderPaletteCards, updatePaletteSelection, renderHarmony, renderPerfume, renderProducts, formatColorValue } from './ui.js';

export function createPaletteController({ mainCanvas, haptic, copyToClipboard, analyzeImagePalette, onPaletteChange }) {
  const ctx = mainCanvas.getContext('2d', { willReadFrequently: true });
  const pinsLayer = $('pinsLayer');
  let pinBackup = null;
  const debounce = createDebounce();
  let analysisPending = false;
  function scheduleAnalysis() {
    analysisPending = true;
    debounce(() => { analysisPending = false; analyzeImagePalette(); });
  }

  function sampleCanvasColor(px, py, kernelSize = state.kernelSize) {
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

  function refreshPaletteShares() {
    recalculateShares(state.palette, state.sampledPixels);
    applySort(false);
  }

  function applySort(rerender = true) {
    const sel = selectedColor();
    const selId = sel ? sel.id : null;
    state.palette = sortPaletteItems(state.palette, state.sortBy);
    if (selId) setSelected(selId);
    else if (state.palette.length) setSelected(state.palette[0].id);
    if (rerender) renderAll();
  }

  function copyColor(item) {
    return copyToClipboard(formatColorValue(item), rgbToHex(item.r, item.g, item.b), getPoeticColorName(item.r, item.g, item.b));
  }

  function selectColor(id) {
    setSelected(id);
    haptic('light');
    updatePaletteSelection($('paletteList'));
    renderHarmonyView();
  }

  function removeColor(id) {
    state.palette = state.palette.filter(c => c.id !== id);
    refreshPaletteShares();
    renderAll();
  }

  function addColor(x, y) {
    if (state.palette.length >= MAX_PINS) {
      showToast(`Лимит ${MAX_PINS} точек`, '#f43f5e', 'Достигнут лимит пинов');
      return null;
    }
    const rgb = sampleCanvasColor(x * mainCanvas.width, y * mainCanvas.height);
    const item = { ...rgb, x, y, count: 0, percentage: 0, id: makeId('pin-custom'), role: 'secondary', roleNote: 'Точка пользователя (измерение области)' };
    state.palette.push(item);
    setSelected(item.id);
    refreshPaletteShares();
    renderAll();
    return item;
  }

  function renderPaletteView() {
    renderProportion($('proportionBar'), $('proportionLegend'), $('rule603010Grid'), $('stylistVerdictBadge'), selectColor);
    renderPaletteCards($('paletteList'), selectColor, copyColor, removeColor);
  }

  function renderHarmonyView() {
    renderHarmony($('harmonyContainer'),
      (hex, name) => copyToClipboard(hex, hex, name),
      (combo) => copyToClipboard(combo.swatches.map(s => `${s.name} ${s.hex}`).join(' · '), combo.swatches[0].hex, combo.title));
  }

  function renderPinView() {
    renderPins(pinsLayer, mainCanvas, {
      onPinDown: (e, item, index, pin) => {
        e.stopPropagation();
        e.preventDefault();
        state.draggingPinId = item.id;
        pinBackup = { x: item.x, y: item.y, r: item.r, g: item.g, b: item.b, center: item.center };
        selectColor(item.id);
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
          refreshPaletteShares();
        }
        state.draggingPinId = null;
        pinBackup = null;
        renderAll();
      }
    });
  }

  function renderAll() {
    renderPinView();
    renderPaletteView();
    renderHarmonyView();
    renderPerfume($('olfactoryHeaderBanner'), $('olfactoryPyramidGrid'), $('weatherAdviceText'), $('matchedPerfumesGrid'), $('perfumeRadarCanvas'));
    renderProducts($('matchedProductsGrid'), (sku, hex, title) => copyToClipboard(sku, hex, title));
    const t = $('timingsLine');
    if (t && state.timings.harmony) {
      const m = t.textContent.match(/точек \d+/) || [''];
      t.textContent = `выборка ${state.timings.sample} мс · кластеры ${state.timings.cluster} мс · гармонии ${state.timings.harmony} мс · ${m[0]}`;
    }
    onPaletteChange();
  }

  function movePinToClientPos(item, clientX, clientY) {
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
    const colorChanged = item.r !== s.r || item.g !== s.g || item.b !== s.b || item.center !== undefined;
    item.r = s.r; item.g = s.g; item.b = s.b;
    // Центр кластера = новый замер (пин — измерение области), доля пересчитывается.
    // Чтобы один пин не разрушал всю палитру: меняем только его центр.
    item.center = undefined; // recalculateShares использует display-цвет как центр пина
    if (colorChanged) refreshPaletteShares();
    const pinEl = pinsLayer.querySelector(`[data-id="${item.id}"]`);
    if (pinEl) {
      const hex = rgbToHex(item.r, item.g, item.b);
      pinEl.style.left = `${normX * 100}%`;
      pinEl.style.top = `${normY * 100}%`;
      pinEl.style.backgroundColor = hex;
      pinEl.style.color = textOnColor(item);
      pinEl.title = `${getPoeticColorName(item.r, item.g, item.b)} (${hex})`;
    }
    if (colorChanged) {
      renderPaletteView();
      renderHarmonyView();
    }
  }

  // Клик по фото = новый пользовательский пин (лимит MAX_PINS).
  mainCanvas.addEventListener('click', (e) => {
    if (state.draggingPinId) return;
    const rect = mainCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const normX = Math.min(0.995, Math.max(0.005, (e.clientX - rect.left) / rect.width));
    const normY = Math.min(0.995, Math.max(0.005, (e.clientY - rect.top) / rect.height));
    const item = addColor(normX, normY);
    if (item) copyColor(item);
  });

  document.querySelectorAll('[data-algo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.algorithm = btn.dataset.algo;
      haptic('light');
      setToggleGroup('algo', state.algorithm);
      analyzeImagePalette();
    });
  });

  $('colorCountSlider').addEventListener('input', (e) => {
    state.colorCount = parseInt(e.target.value, 10);
    $('colorCountValue').textContent = state.colorCount;
    scheduleAnalysis();
  });
  $('deltaSlider').addEventListener('input', (e) => {
    state.minDelta = parseInt(e.target.value, 10);
    $('deltaValue').textContent = state.minDelta;
    scheduleAnalysis();
  });
  $('sortSelect').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    applySort(true);
  });
  document.querySelectorAll('[data-format]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeFormat = btn.dataset.format;
      setToggleGroup('format', state.activeFormat);
      renderPaletteCards($('paletteList'), selectColor, copyColor, removeColor);
    });
  });
  document.querySelectorAll('[data-kernel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.kernelSize = parseInt(btn.dataset.kernel, 10);
      haptic('light');
      setToggleGroup('kernel', state.kernelSize);
    });
  });
  $('togglePinsCheckbox').addEventListener('change', (e) => {
    state.showPins = e.target.checked;
    renderPinView();
  });
  $('addCustomPinBtn').addEventListener('click', () => {
    addColor(0.3, 0.4);
  });
  $('recalculateBtn').addEventListener('click', () => { haptic('light'); analyzeImagePalette(); });
  $('copyAllHexBtn').addEventListener('click', () => {
    const all = state.palette.map((c) => `${getPoeticColorName(c.r, c.g, c.b)} (${rgbToHex(c.r, c.g, c.b)})`).join(', ');
    copyToClipboard(all || '—', state.palette.length ? rgbToHex(state.palette[0].r, state.palette[0].g, state.palette[0].b) : '#f43f5e', 'Вся палитра скопирована');
  });

  return { renderAll, applySort, settlePending() {
    debounce.cancel();
    if (analysisPending) { analysisPending = false; analyzeImagePalette(); }
  }, cancelPending() {
    debounce.cancel();
    analysisPending = false;
    if (pinBackup && state.draggingPinId) {
      const item = state.palette.find(c => c.id === state.draggingPinId);
      if (item) Object.assign(item, pinBackup);
      refreshPaletteShares();
    }
    state.draggingPinId = null;
    pinBackup = null;
  } };
}
