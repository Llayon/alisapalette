import { $, setToggleGroup } from '../dom.js';
import { showToast } from '../notifications.js';
import { bindCropPreview } from './crop-controller.js';
import { state } from '../state.js';
import { rgbToHex } from '../color-science.js';
import { getPoeticColorName } from '../poetic.js';
import { renderStory } from './renderer.js';
import { renderStoryToBlob, storyFileName, downloadBlob } from './export.js';
import { shareFile, canShareFile } from './share.js';
import { state as story, storyKey, touchStory, resetStoryForPhoto, isValidChannel, APP_URL } from './story-state.js';
import { templateIds } from './templates.js';

export function createStoryStudio({ mainCanvas, haptic, copyToClipboard }) {
  const exportModal = $('exportModal');
  const exportCodeArea = $('exportCodeArea');
  const storyPreview = $('storyPreview');
  const storyStatus = $('storyStatus');
  let lastFocusBeforeStudio = null;
  let storyPrepareTimer = null;
  let storyJobSeq = 0;
  let lastStoryPaletteSig = '';

  function syncStoryPalette() {
    const signature = paletteSig();
    if (signature === lastStoryPaletteSig) return;
    lastStoryPaletteSig = signature;
    clearTimeout(storyPrepareTimer);
    storyJobSeq++;
    touchStory();
    if (!exportModal.classList.contains('hidden')) {
      generateExportCode();
      scheduleStoryPrepare();
    }
  }

  function paletteSig() {
    return state.palette.map((c) => `${c.r},${c.g},${c.b},${c.percentage}`).join(';');
  }

  function storyInput() {
    return {
      template: story.template,
      photo: mainCanvas.width ? mainCanvas : null,
      palette: state.palette,
      title: story.title,
      channel: isValidChannel(story.channel) ? story.channel.trim() : '',
      count: story.count,
      showNames: story.showNames,
      showHex: story.showHex,
      showPct: story.showPct,
      fit: story.fit,
      cropX: story.cropX,
      cropY: story.cropY,
      olfactory: state.olfactoryProfile
    };
  }

  function setStoryStatus(kind, text) {
    storyStatus.className = 'timings ' + (kind || '');
    storyStatus.textContent = text;
  }

  /** Синхронный предпросмотр тем же renderer (540×960). */
  function renderStoryPreview() {
    try {
      const ctxp = storyPreview.getContext('2d');
      ctxp.clearRect(0, 0, storyPreview.width, storyPreview.height);
      renderStory(ctxp, storyPreview.width, storyPreview.height, storyInput());
    } catch (e) {
      setStoryStatus('error', 'Предпросмотр недоступен');
    }
  }

  function syncStoryInputs() {
    setToggleGroup('story-template', story.template);
    setToggleGroup('story-count', story.count);
    setToggleGroup('story-fit', story.fit);
    $('storyTitleInput').value = story.title;
    $('storyChannelInput').value = story.channel;
    $('storyNames').checked = story.showNames;
    $('storyHex').checked = story.showHex;
    $('storyPct').checked = story.showPct;
    $('shareStoryBtn').disabled = !story.cache.ready;
    $('shareStoryBtn').title = typeof navigator.share !== 'function'
      ? 'Системная отправка не поддерживается — используйте сохранение PNG'
      : (!story.cache.ready ? 'Открытка готовится…' : 'Отправить через системное меню');
  }

  /**
   * Асинхронная подготовка Blob с версионированием: устаревший результат
   * отбрасывается и никогда не попадёт в share/save.
   */
  function scheduleStoryPrepare() {
    if (cropController.active) return;
    renderStoryPreview();
    syncStoryInputs();
    clearTimeout(storyPrepareTimer);
    const mySeq = ++storyJobSeq;
    const key = storyKey(story, paletteSig(), mainCanvas.width, mainCanvas.height);
    if (story.cache.ready && story.cache.key === key && story.cache.blob) {
      setStoryStatus('ready', `Готово · PNG ${story.cache.W}×${story.cache.H}${story.cache.fallback ? ' (эконом-режим)' : ''}`);
      return;
    }
    setStoryStatus('busy', 'Готовим открытку…');
    syncStoryInputs();
    storyPrepareTimer = setTimeout(async () => {
      if (mySeq !== storyJobSeq) return; // устаревшая задача
      const myVersion = story.version;
      const t0 = performance.now();
      try {
        const res = await renderStoryToBlob(storyInput());
        if (mySeq !== storyJobSeq || myVersion !== story.version) return; // настройки изменились
        renderStoryPreview(); // Fonts used by the PNG are now available to the preview too.
        if (story.cache.url) { try { URL.revokeObjectURL(story.cache.url); } catch { /* noop */ } }
        story.cache = {
          key, blob: res.blob, url: URL.createObjectURL(res.blob),
          ready: true, W: res.W, H: res.H, fallback: res.fallback,
          ms: Math.round(performance.now() - t0)
        };
        setStoryStatus('ready', `Готово за ${story.cache.ms} мс · PNG ${res.W}×${res.H}${res.fallback ? ' (эконом-режим)' : ''}`);
      } catch (e) {
        if (mySeq !== storyJobSeq) return;
        setStoryStatus('error', 'Не получилось собрать открытку. Попробуйте другой шаблон.');
      }
      syncStoryInputs();
    }, 220);
  }

  function openStudio(event) {
    haptic('light');
    lastFocusBeforeStudio = event?.currentTarget instanceof HTMLElement ? event.currentTarget : document.activeElement;
    if (!lastFocusBeforeStudio || lastFocusBeforeStudio === document.body) lastFocusBeforeStudio = $('openStoriesModalBtn');
    generateExportCode();
    exportModal.classList.remove('hidden');
    scheduleStoryPrepare();
    $('savePngBtn').focus();
  }

  function closeStudio() {
    cropController.cancel({ notify: false });
    storyJobSeq++;
    exportModal.classList.add('hidden');
    clearTimeout(storyPrepareTimer);
    if (lastFocusBeforeStudio && lastFocusBeforeStudio.focus) {
      try { lastFocusBeforeStudio.focus(); } catch { /* noop */ }
    }
  }

  // A late font load replaces both fallback preview and cached PNG together.
  document.fonts?.addEventListener('loadingdone', () => {
    touchStory();
    if (!exportModal.classList.contains('hidden')) scheduleStoryPrepare();
  });

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

  $('openStoriesModalBtn').addEventListener('click', openStudio);
  window.openStoryStudio = openStudio;
  window.__installStoryDiagnostics?.((ctx, W, H, template) => renderStory(ctx, W, H, { ...storyInput(), template }));
  $('closeExportBtn').addEventListener('click', closeStudio);
  exportModal.addEventListener('click', (e) => { if (e.target === exportModal) closeStudio(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !exportModal.classList.contains('hidden')) closeStudio();
    // Лёгкая Tab-ловушка открытой студии: фокус циклически внутри модалки.
    if (e.key === 'Tab' && !exportModal.classList.contains('hidden')) {
      const items = [...exportModal.querySelectorAll('button, input, select, textarea, [tabindex="0"]')].filter((el) => !el.disabled && el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  document.querySelectorAll('[data-story-template]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!templateIds().includes(btn.dataset.storyTemplate)) return;
      story.template = btn.dataset.storyTemplate;
      haptic('light');
      touchStory();
      scheduleStoryPrepare();
    });
  });
  document.querySelectorAll('[data-story-count]').forEach((btn) => {
    btn.addEventListener('click', () => {
      story.count = Math.min(6, Math.max(3, parseInt(btn.dataset.storyCount, 10) || 5));
      touchStory();
      scheduleStoryPrepare();
    });
  });
  document.querySelectorAll('[data-story-fit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      story.fit = btn.dataset.storyFit === 'contain' ? 'contain' : 'cover';
      touchStory();
      scheduleStoryPrepare();
    });
  });
  $('storyTitleInput').addEventListener('input', (e) => {
    story.title = e.target.value;
    touchStory();
    scheduleStoryPrepare();
  });
  $('storyChannelInput').addEventListener('input', (e) => {
    story.channel = e.target.value.trim();
    touchStory();
    scheduleStoryPrepare();
  });
  for (const [id, key] of [['storyNames', 'showNames'], ['storyHex', 'showHex'], ['storyPct', 'showPct']]) {
    $(id).addEventListener('change', (e) => {
      story[key] = e.target.checked;
      touchStory();
      scheduleStoryPrepare();
    });
  }

  // Смещение фото пальцем/мышью прямо на предпросмотре (только cover).
  const cropController = bindCropPreview(storyPreview, story, {
    onStart() {
      clearTimeout(storyPrepareTimer);
      storyJobSeq++;
      touchStory();
      syncStoryInputs();
    },
    onPreview: renderStoryPreview,
    onFinish() { touchStory(); scheduleStoryPrepare(); }
  });

  // Сохранить PNG — независимо от Web Share
  $('savePngBtn').addEventListener('click', async () => {
    if (cropController.active) {
      setStoryStatus('busy', 'Завершите кадрирование перед сохранением.');
      return;
    }
    haptic('light');
    setStoryStatus('busy', 'Сохраняем PNG…');
    const key = storyKey(story, paletteSig(), mainCanvas.width, mainCanvas.height);
    const version = story.version;
    const isCurrent = () => version === story.version && key === storyKey(story, paletteSig(), mainCanvas.width, mainCanvas.height) && !cropController.active;
    try {
      let blob = story.cache.ready && story.cache.key === key ? story.cache.blob : null;
      let W = story.cache.W, H = story.cache.H;
      if (!blob) {
        const res = await renderStoryToBlob(storyInput());
        if (!isCurrent()) return;
        blob = res.blob; W = res.W; H = res.H;
        if (story.cache.url) URL.revokeObjectURL(story.cache.url);
        story.cache = { key, blob, url: URL.createObjectURL(blob), ready: true, W, H, fallback: res.fallback };
      }
      downloadBlob(blob, storyFileName(story.template, W, H));
      haptic('success');
      showToast(`PNG ${W}×${H} сохранён`, '#34d399', 'Открытка');
      setStoryStatus('ready', `PNG ${W}×${H} сохранён · ${storyFileName(story.template, W, H)}`);
    } catch {
      if (!isCurrent()) return;
      setStoryStatus('error', 'Не получилось сохранить. На iPhone: удерживайте картинку предпросмотра.');
    }
    syncStoryInputs();
  });

  // Поделиться — только готовый Blob, вызов share прямо в клике (user activation)
  $('shareStoryBtn').addEventListener('click', async () => {
    haptic('light');
    const key = storyKey(story, paletteSig(), mainCanvas.width, mainCanvas.height);
    const cached = story.cache.ready && story.cache.key === key ? story.cache : null;
    if (!cached || !cached.blob) {
      showToast('Открытка ещё готовится — подождите секунду', '#fbbf24', 'Подождите');
      return;
    }
    const file = new File([cached.blob], storyFileName(story.template, cached.W, cached.H), { type: 'image/png' });
    if (!canShareFile(file)) {
      showToast('Здесь отправка файлов не поддерживается — используйте «Сохранить PNG»', '#fbbf24', 'Нет отправки');
      return;
    }
    const res = await shareFile(file, { title: story.title || 'ChromaStyle', text: `Моя палитра · ${APP_URL}` });
    if (res.status === 'shared') {
      haptic('success');
      showToast('Системное меню отправки открыто', '#34d399', 'Готово');
    } else if (res.status === 'error') {
      setStoryStatus('error', `Отправка не удалась (${res.error || 'ошибка'}). Сохраните PNG.`);
    }
    // cancelled: молча, без fallback-скачивания. unsupported уже обработан выше.
  });

  $('copyAppLinkBtn').addEventListener('click', async () => {
    haptic('light');
    await copyToClipboard(APP_URL, '#f43f5e', 'Ссылка на приложение');
  });
  document.querySelectorAll('[data-code]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeCodeTab = btn.dataset.code;
      setToggleGroup('code', state.activeCodeTab);
      generateExportCode();
    });
  });
  $('copyExportCodeBtn').addEventListener('click', () => copyToClipboard(exportCodeArea.value, '#f43f5e', 'Код скопирован'));


  return {
    syncPalette: syncStoryPalette,
    beforePhotoChange() {
      cropController.cancel({ notify: false });
      clearTimeout(storyPrepareTimer);
      storyJobSeq++;
    },
    resetForPhoto: resetStoryForPhoto,
    afterPhotoChange() {
      if (!exportModal.classList.contains('hidden')) scheduleStoryPrepare();
    }
  };
}
