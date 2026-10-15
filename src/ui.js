/**
 * UI-рендер: фото -> палитра -> сочетания -> сохранить.
 * Чистые функции рендера + адаптеры к новому движку (пины, экспорт, парфюм).
 */
import { rgbToHex, hexToRgb, textOnColor, rgbToOklch, oklabDistanceRgb, relativeLuminance } from './color-science.js';
import { getPoeticColorName } from './poetic.js';
import { trioForColor, classicalHarmonies, inPhotoCombinations } from './harmony.js';
import { state, selectedColor } from './state.js';
import { matchProducts, OLFACTORY_ARCHETYPES, getClosestOlfactoryArchetype, computeAccordCosineSimilarity, calculateSprayDosage, PERFUME_CATALOG } from './perfume.js';

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function formatColorValue(c) {
  if (state.activeFormat === 'rgb') return `rgb(${c.r}, ${c.g}, ${c.b})`;
  if (state.activeFormat === 'hsl') {
    const { h, s, l } = rgbToHslLocal(c.r, c.g, c.b);
    return `hsl(${h}°, ${s}%, ${l}%)`;
  }
  return rgbToHex(c.r, c.g, c.b);
}

function rgbToHslLocal(r, g, b) {
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

// ---------- pins ----------

export function renderPins(pinsLayer, mainCanvas, callbacks) {
  pinsLayer.innerHTML = '';
  if (!state.showPins) return;
  state.palette.forEach((item, index) => {
    const hex = rgbToHex(item.r, item.g, item.b);
    const pin = document.createElement('div');
    pin.className = 'color-pin' + (state.activeHighlightId === item.id ? ' active-pin' : '');
    pin.style.left = `${item.x * 100}%`;
    pin.style.top = `${item.y * 100}%`;
    pin.style.backgroundColor = hex;
    pin.style.color = textOnColor(item);
    pin.dataset.id = item.id;
    pin.title = `${getPoeticColorName(item.r, item.g, item.b)} (${hex})`;
    pin.textContent = String(index + 1);
    pin.addEventListener('pointerdown', (e) => callbacks.onPinDown(e, item, index, pin));
    pin.addEventListener('pointermove', (e) => callbacks.onPinMove(e, item));
    pin.addEventListener('pointerup', (e) => callbacks.onPinUp(e, item));
    pin.addEventListener('pointercancel', (e) => callbacks.onPinCancel(e, item));
    pinsLayer.appendChild(pin);
  });
}

// ---------- proportion bar: точная геометрия ----------

export function renderProportion(barEl, legendEl, gridEl, badgeEl, onSelect) {
  barEl.innerHTML = '';
  legendEl.innerHTML = '';
  gridEl.innerHTML = '';
  if (!state.palette.length) {
    // ВАЖНО: сбрасываем устаревшие данные (фикс дефекта старого блока 60-30-10).
    badgeEl.textContent = '—';
    gridEl.innerHTML = '<div class="notice">Загрузите фото — здесь появится разбор долей.</div>';
    return;
  }
  const sorted = [...state.palette].sort((a, b) => b.percentage - a.percentage);

  for (const item of sorted) {
    const hex = rgbToHex(item.r, item.g, item.b);
    const seg = document.createElement('div');
    // Точная ширина — никаких Math.max(pct, 3).
    seg.style.setProperty('--w', '1');
    seg.style.flex = `0 0 ${item.percentage}%`;
    seg.style.width = `${item.percentage}%`;
    seg.style.backgroundColor = hex;
    seg.title = `${getPoeticColorName(item.r, item.g, item.b)} (${hex}) — ${item.percentage}%`;
    if (item.percentage >= 9) {
      const label = document.createElement('span');
      label.style.color = textOnColor(item);
      label.textContent = `${Math.round(item.percentage)}%`;
      seg.appendChild(label);
    }
    seg.addEventListener('click', () => onSelect(item.id));
    barEl.appendChild(seg);
  }

  // Компактная копия полосы в карточку палитры (без подписей).
  const mini = document.getElementById('miniPropBar');
  if (mini) {
    mini.innerHTML = '';
    for (const item of sorted) {
      const mseg = document.createElement('div');
      mseg.style.flex = `0 0 ${item.percentage}%`;
      mseg.style.width = `${item.percentage}%`;
      mseg.style.backgroundColor = rgbToHex(item.r, item.g, item.b);
      mini.appendChild(mseg);
    }
  }

  // Выноски-подписи для маленьких сегментов (вместо искажения ширины).
  for (const item of sorted) {
    const hex = rgbToHex(item.r, item.g, item.b);
    const row = document.createElement('div');
    row.className = 'legend-row';
    row.innerHTML = `<span class="sw" style="background:${hex}"></span>
      <span class="nm">${esc(getPoeticColorName(item.r, item.g, item.b))} <span class="mono" style="color:var(--faint)">${hex}</span></span>
      <span class="pc">${item.percentage.toFixed(1)}%</span>`;
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => onSelect(item.id));
    legendEl.appendChild(row);
  }

  // Фактическое распределение vs предлагаемая композиция 60-30-10 (разделены!).
  if (sorted.length >= 1) {
    const top3 = sorted.slice(0, 3);
    const sum3 = top3.reduce((s, c) => s + c.percentage, 0);
    const factHtml = top3.map((c, i) => {
      const hex = rgbToHex(c.r, c.g, c.b);
      const role = ['Доминанта', 'Вторичный', 'Третий'][i] || '';
      return `<div class="role-card"><span class="sw" style="background:${hex}"></span>
        <span style="min-width:0"><span class="t">Факт кадра · ${role}</span><br>
        <span class="n">${esc(getPoeticColorName(c.r, c.g, c.b))}</span><br>
        <span class="p">${c.percentage.toFixed(1)}% кадра</span></span></div>`;
    }).join('');
    const proposal = propose603010(sorted);
    gridEl.innerHTML = `<div class="notice" style="grid-column:1/-1">Фактическое распределение цветов фотографии — выше. Ниже — <b>стилистическая рекомендация</b> «60–30–10» (не вердикт фото, композиция для образа/интерьера).</div>`
      + factHtml
      + `<div class="notice" style="grid-column:1/-1"><b>Предлагаемая композиция 60–30–10:</b> ${proposal.text}<br><span class="explain">${proposal.detail}</span></div>`;
    void sum3;
    badgeEl.textContent = `Топ-3: ${top3.map((c) => c.percentage.toFixed(0)).join(' / ')}%`;
  }
}

/**
 * Агрегирование по ролям для рекомендации 60-30-10 с явным составом групп.
 * Роли всегда разные оттенки (без дублей); при 1–2 цветах недостающие роли
 * честно помечаются как «добавить». Это предложение композиции, а не измерение:
 * целевые 60/30/10 отделены от фактических процентов кадра.
 */
export function propose603010(sorted) {
  if (!sorted.length) return { text: '—', detail: '' };
  const base = sorted[0];
  const rest = sorted.slice(1);
  const companion = rest.find((c) => c.percentage >= 8) || rest[0] || null;
  // Акцент — самый насыщенный малый оттенок, исключая уже занятые роли.
  const accent = [...sorted]
    .sort((a, b) => rgbToOklch(b).C - rgbToOklch(a).C)
    .find((c) => c !== base && c !== companion && c.percentage <= 18) || null;
  const bHex = rgbToHex(base.r, base.g, base.b);
  const text = `База ~60%: ${getPoeticColorName(base.r, base.g, base.b)} (${bHex})` +
    (companion
      ? ` · Компаньон ~30%: ${getPoeticColorName(companion.r, companion.g, companion.b)} (${rgbToHex(companion.r, companion.g, companion.b)})`
      : ' · Компаньон ~30%: в кадре один оттенок — можно добавить') +
    (accent
      ? ` · Акцент ~10%: ${getPoeticColorName(accent.r, accent.g, accent.b)} (${rgbToHex(accent.r, accent.g, accent.b)})`
      : ' · Акцент ~10%: в кадре нет отдельного малого оттенка — можно добавить');
  const detail = `Группы: база — «${getPoeticColorName(base.r, base.g, base.b)}» (в кадре ${base.percentage.toFixed(1)}%, цель ~60%)` +
    (companion
      ? `; компаньон — «${getPoeticColorName(companion.r, companion.g, companion.b)}» (в кадре ${companion.percentage.toFixed(1)}%, цель ~30%)`
      : '; компаньона в кадре нет') +
    (accent
      ? `; акцент — «${getPoeticColorName(accent.r, accent.g, accent.b)}» (в кадре ${accent.percentage.toFixed(1)}%, цель ~10%). Это рекомендация композиции, а не измерение.`
      : '; акцента в кадре нет. Это рекомендация композиции, а не измерение.');
  return { text, detail };
}

// ---------- palette cards ----------

export function renderPaletteCards(listEl, onSelect, onCopy, onRemove) {
  listEl.innerHTML = '';
  if (!state.palette.length) {
    listEl.innerHTML = '<div class="notice">Палитра появится после загрузки фото.</div>';
    return;
  }
  state.palette.forEach((item, index) => {
    const hex = rgbToHex(item.r, item.g, item.b);
    const poetic = getPoeticColorName(item.r, item.g, item.b);
    const sel = state.selectedColorId === item.id;
    const card = document.createElement('div');
    card.className = 'pal-card' + (sel ? ' sel' : '');
    card.setAttribute('role', 'listitem');
    const roleLabel = item.role === 'dominant' ? 'Основной' : item.role === 'accent' ? 'Акцент' : 'Второстепенный';
    card.innerHTML = `
      <button type="button" class="pal-main" aria-pressed="${sel}" aria-label="Выбрать ${esc(poetic)}, ${hex}">
        <span style="position:relative;flex:none">
          <span class="big" style="background:${hex}"><span class="num">#${index + 1}</span></span>
          <span class="pal-check" aria-hidden="true"><svg class="ic"><use href="#i-check"/></svg></span>
        </span>
        <span style="min-width:0;flex:1">
          <span class="nm">${esc(poetic)}</span>
          <span class="meta"><span class="mono">${esc(formatColorValue(item))}</span>
          <span class="pct">${item.percentage.toFixed(1)}%</span>
          <span class="role">${roleLabel}</span></span>
        </span>
      </button>
      <span class="acts">
        <button type="button" class="iconbtn" data-act="copy" title="Скопировать HEX" aria-label="Скопировать ${hex}">⧉</button>
        ${state.palette.length > 1 ? `<button type="button" class="iconbtn" data-act="del" title="Убрать оттенок" aria-label="Убрать ${esc(poetic)}">✕</button>` : ''}
      </span>`;
    card.querySelector('.pal-main').addEventListener('click', () => onSelect(item.id));
    card.querySelector('[data-act="copy"]').addEventListener('click', (e) => { e.stopPropagation(); onCopy(item); });
    const del = card.querySelector('[data-act="del"]');
    if (del) del.addEventListener('click', (e) => { e.stopPropagation(); onRemove(item.id); });
    card.addEventListener('mouseenter', () => { state.activeHighlightId = item.id; });
    card.addEventListener('mouseleave', () => { state.activeHighlightId = null; });
    listEl.appendChild(card);
  });
}

// ---------- harmony widget ----------

export function renderHarmony(container, onCopyHex, onCopyCombo) {
  container.innerHTML = '';
  const t0 = performance.now();
  const base = selectedColor();
  if (!base) {
    container.innerHTML = '<div class="notice">Выберите цвет палитры — здесь появятся сочетания.</div>';
    return;
  }
  const baseHex = rgbToHex(base.r, base.g, base.b);
  const baseName = getPoeticColorName(base.r, base.g, base.b);
  const trio = trioForColor(base, state.palette);
  const combos = [trio.calm, trio.contrast, trio.accent];

  const head = document.createElement('div');
  head.className = 'legend-row';
  head.innerHTML = `<span class="sw" style="background:${baseHex}"></span>
    <span class="nm">Выбран: <b>${esc(baseName)}</b> <span class="mono">${baseHex}</span></span>`;
  container.appendChild(head);

  // 1) Сочетания из вашего фото (только найденное)
  const inPhoto = inPhotoCombinations(state.palette);
  const photoBox = document.createElement('div');
  photoBox.className = 'combo';
  if (inPhoto.found.length) {
    photoBox.innerHTML = `<h3>Сочетания из вашего фото</h3><p>Только оттенки, действительно найденные в кадре. Новые цвета не придуманы.</p>`;
    for (const f of inPhoto.found) {
      const row = document.createElement('div');
      const members = f.members.map((m) => {
        const c = m.p;
        const hx = rgbToHex(c.r, c.g, c.b);
        const nm = getPoeticColorName(c.r, c.g, c.b);
        return `<div class="swrow" data-hex="${hx}" data-name="${esc(nm)}"><span class="sw" style="background:${hx}"></span><span class="hx">${hx}</span><span class="nn">${esc(nm)} · ${c.percentage.toFixed(1)}%</span><span class="src">из фото</span></div>`;
      }).join('');
      row.innerHTML = `<div style="font-size:12px;font-weight:700;margin:6px 0 2px">${esc(f.title)}</div><div class="explain">${esc(f.explain)}</div>${members}`;
      row.querySelectorAll('.swrow').forEach((r) => r.addEventListener('click', () => onCopyHex(r.dataset.hex, r.dataset.name || r.dataset.hex)));
      photoBox.appendChild(row);
    }
  } else {
    photoBox.innerHTML = `<h3>Сочетания из вашего фото</h3><p>${esc(inPhoto.note)}</p>`;
  }
  container.appendChild(photoBox);

  // 2) Какие цвета можно добавить (трио)
  const trioWrap = document.createElement('div');
  trioWrap.innerHTML = `<h3 style="font-size:13px;margin:4px 0 0">Какие цвета можно добавить</h3>
    <p class="explain">Сгенерированные рекомендации на основе OKLCH (не найдены в кадре). Нажмите на оттенок — HEX скопируется.</p>`;
  container.appendChild(trioWrap);

  const grid = document.createElement('div');
  grid.className = 'trio';
  for (const combo of combos) {
    const el = document.createElement('div');
    el.className = 'combo';
    const total = combo.swatches.length;
    const strip = combo.swatches.map((s) => `<div style="--w:${(100 / total).toFixed(1)};flex:${(100 / total).toFixed(1)} 1 0%;background:${s.hex}" title="${esc(s.name)} ${s.hex}"></div>`).join('');
    const rows = combo.swatches.map((s) => `
      <div class="swrow" data-hex="${s.hex}" data-name="${esc(s.name)}">
        <span class="sw" style="background:${s.hex}"></span>
        <span class="hx">${s.hex}</span>
        <span class="nn">${esc(s.name)}</span>
        <span class="src">${s.badge || (s.source === 'photo' ? 'ваш цвет' : 'добавить')}</span>
      </div>`).join('');
    el.innerHTML = `<h3>${combo.title}</h3><p>${esc(combo.explain)}</p>
      <div class="strip">${strip}</div><div class="swatches">${rows}</div>
      <button class="btn small copybtn" style="width:100%;justify-content:center">Скопировать сочетание</button>`;
    el.querySelectorAll('.swrow').forEach((r) => r.addEventListener('click', () => onCopyHex(r.dataset.hex, r.dataset.name)));
    el.querySelector('.copybtn').addEventListener('click', () => onCopyCombo(combo));
    grid.appendChild(el);
  }
  container.appendChild(grid);

  // 3) Классические гармонии — компактно
  const det = document.createElement('details');
  det.className = 'adv';
  det.open = state.harmonyOpen;
  det.addEventListener('toggle', () => { state.harmonyOpen = det.open; });
  const harm = classicalHarmonies(base);
  const order = ['monochrome', 'analogous', 'complementary', 'split', 'triad', 'neutral'];
  const cards = order.map((k) => {
    const h = harm[k];
    const strip = h.swatches.map((s) => `<div style="flex:1 1 0%;background:${s.hex}" title="${esc(s.name)} ${s.hex}"></div>`).join('');
    const rows = h.swatches.map((s) => `<div class="swrow" data-hex="${s.hex}" data-name="${esc(s.name)}"><span class="sw" style="background:${s.hex}"></span><span class="hx">${s.hex}</span><span class="nn">${esc(s.name)}</span><span class="src">добавить</span></div>`).join('');
    return `<div class="combo"><h3>${h.title}</h3><p>${esc(h.explain)}</p><div class="strip">${strip}</div>${rows}</div>`;
  }).join('');
  det.innerHTML = `<summary>Классические гармонии (6 типов) — для ${esc(baseName)}</summary><div class="body"><div class="harmgrid">${cards}</div>
    <div class="explain">Пояснение «почему сочетается»: спокойные — близкие hue; контрастные — противоположные области круга со сдержанной насыщенностью; нейтральные — тёплые/холодные ступени светлоты. Это эвристики композиции, а не научная оценка красоты.</div></div>`;
  det.querySelectorAll('.swrow').forEach((r) => r.addEventListener('click', () => onCopyHex(r.dataset.hex, r.dataset.name)));
  container.appendChild(det);

  state.timings.harmony = Math.round(performance.now() - t0);
}

// ---------- perfume & products (адаптеры, движок не переписан) ----------

export function renderPerfume(bannerEl, pyramidEl, dosageEl, perfGridEl, radarCanvas) {
  if (!state.palette.length) {
    bannerEl.innerHTML = '<div class="notice">Аромат появится после разбора фото.</div>';
    pyramidEl.innerHTML = '';
    perfGridEl.innerHTML = '';
    return;
  }
  const sorted = [...state.palette].sort((a, b) => b.percentage - a.percentage);
  const baseColor = sorted[0];
  const heartColor = sorted[1] || sorted[0];
  const topColor = sorted[sorted.length - 1] || sorted[0];
  const baseArch = getClosestOlfactoryArchetype(baseColor);
  const heartArch = getClosestOlfactoryArchetype(heartColor);
  const topArch = getClosestOlfactoryArchetype(topColor);
  const axes = ['lactonic', 'gourmand', 'fresh', 'green', 'floral', 'woody'];
  const photoVector = {};
  axes.forEach((axis) => {
    photoVector[axis] = Math.round(baseArch.vector[axis] * 0.5 + heartArch.vector[axis] * 0.35 + topArch.vector[axis] * 0.15);
  });
  const scored = PERFUME_CATALOG.map((perf) => {
    const cosSim = computeAccordCosineSimilarity(photoVector, perf.vector);
    const perfRgb = hexToRgb(perf.hex);
    const dBase = oklabDistanceRgb(perfRgb, baseColor);
    const dHeart = oklabDistanceRgb(perfRgb, heartColor);
    const colorAffinity = Math.max(0, 1 - Math.min(dBase, dHeart) / 0.55);
    const totalScore = Math.min(99, Math.max(76, Math.round((cosSim * 0.78 + colorAffinity * 0.22) * 100)));
    const dosage = calculateSprayDosage(perf.density, state.weatherTemp, state.occasion);
    return { ...perf, matchPercent: totalScore, dosage };
  }).sort((a, b) => b.matchPercent - a.matchPercent);
  const topPerfumes = scored.slice(0, 3);
  const avgDensity = (topPerfumes[0].density + (topPerfumes[1] ? topPerfumes[1].density : topPerfumes[0].density)) / 2;
  const globalDosage = calculateSprayDosage(avgDensity, state.weatherTemp, state.occasion);
  state.olfactoryProfile = { familyName: baseArch.familyName, poeticTitle: baseArch.poeticTitle, topColor, heartColor, baseColor, topNotes: topArch.topNotes, heartNotes: heartArch.heartNotes, baseNotes: baseArch.baseNotes, vector: photoVector, topPerfumes, globalDosage };

  const baseHex = rgbToHex(baseColor.r, baseColor.g, baseColor.b);
  const heartHex = rgbToHex(heartColor.r, heartColor.g, heartColor.b);
  const topHex = rgbToHex(topColor.r, topColor.g, topColor.b);
  bannerEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;min-width:0">
      <span style="width:42px;height:42px;border-radius:12px;flex:none;border:1px solid rgba(255,255,255,.2);background:linear-gradient(135deg, ${topHex}, ${heartHex}, ${baseHex})"></span>
      <span style="min-width:0"><span style="font-size:10px;color:var(--amber);text-transform:uppercase;letter-spacing:.06em">Ольфакторное семейство кадра</span><br>
      <b>${esc(baseArch.poeticTitle)}</b><br><span class="explain">${esc(baseArch.familyName)}</span></span>
    </div>`;
  const tiers = [
    { label: 'Верхние ноты', hex: topHex, notes: topArch.topNotes },
    { label: 'Ноты сердца', hex: heartHex, notes: heartArch.heartNotes },
    { label: 'База и шлейф', hex: baseHex, notes: baseArch.baseNotes }
  ];
  pyramidEl.innerHTML = tiers.map((t) => `<div class="perf"><div style="display:flex;gap:8px;align-items:center"><span style="width:26px;height:26px;border-radius:8px;background:${t.hex};flex:none;border:1px solid rgba(255,255,255,.2)"></span><b>${t.label}</b></div><div class="explain" style="margin-top:4px">${esc(t.notes.join(' • '))}</div></div>`).join('');
  dosageEl.innerHTML = `<b>${globalDosage.sprays} распыления</b> · ${esc(state.occasion)} · ${state.weatherTemp > 0 ? '+' : ''}${state.weatherTemp}°C · летучесть ${globalDosage.volatility}`;
  perfGridEl.innerHTML = topPerfumes.map((p) => {
    const band = p.matchPercent >= 90 ? 'яркое созвучие' : p.matchPercent >= 80 ? 'заметное созвучие' : 'тихое созвучие';
    return `<div class="perf"><div style="display:flex;gap:8px;align-items:center"><span style="width:30px;height:30px;border-radius:9px;background:${p.hex};flex:none;border:1px solid rgba(255,255,255,.2)"></span><span style="min-width:0"><b>${esc(p.brand)} — ${esc(p.name)}</b><br><span class="explain">${esc(p.store)} · ${band} (образное сопоставление)</span></span></div><div class="explain" style="margin-top:4px">${esc(p.notes)}</div></div>`;
  }).join('');
  drawRadar(radarCanvas, photoVector);
}

function drawRadar(canvas, vector) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const axes = ['lactonic', 'gourmand', 'fresh', 'green', 'floral', 'woody'];
  const labels = ['Лакт.', 'Гурм.', 'Свеж.', 'Зел.', 'Цвет.', 'Древ.'];
  const cx = W / 2, cy = H / 2 + 6, R = Math.min(W, H) / 2 - 26;
  ctx.strokeStyle = '#3a322d';
  for (const ring of [0.33, 0.66, 1]) {
    ctx.beginPath();
    axes.forEach((_, i) => {
      const a = (i / axes.length) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * R * ring, y = cy + Math.sin(a) * R * ring;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath(); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(244,63,94,.35)'; ctx.strokeStyle = '#f43f5e';
  ctx.beginPath();
  axes.forEach((k, i) => {
    const v = (vector[k] || 0) / 100;
    const a = (i / axes.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * R * v, y = cy + Math.sin(a) * R * v;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#a8a29e'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center';
  axes.forEach((_, i) => {
    const a = (i / axes.length) * Math.PI * 2 - Math.PI / 2;
    ctx.fillText(labels[i], cx + Math.cos(a) * (R + 14), cy + Math.sin(a) * (R + 14) + 3);
  });
}

export function renderProducts(gridEl, onCopy) {
  if (!state.palette.length) { gridEl.innerHTML = '<div class="notice">Находки подберутся после разбора фото.</div>'; return; }
  const { bloggerProducts } = require_products();
  const top = matchProducts(state.palette, bloggerProducts, 4);
  gridEl.innerHTML = '';
  for (const item of top) {
    const matchedHex = rgbToHex(item.matched.r, item.matched.g, item.matched.b);
    const band = item.matchScore >= 95 ? 'очень близкий оттенок' : item.matchScore >= 85 ? 'близкий оттенок' : 'отдалённый оттенок';
    const el = document.createElement('div');
    el.className = 'prod';
    el.innerHTML = `<span class="sw" style="background:${item.hex}"></span>
      <span style="min-width:0;flex:1"><span class="t">${esc(item.title)}</span><br>
      <span class="explain">${esc(item.store)} · ${esc(item.sku)} · <b style="color:#6ee7b7">${band}</b> · тон фото <span class="mono">${matchedHex}</span></span></span>
      <button type="button" class="iconbtn" title="Скопировать артикул" aria-label="Скопировать ${esc(item.sku)}">⧉</button>`;
    el.querySelector('button').addEventListener('click', () => onCopy(item.sku, item.hex, item.title));
    gridEl.appendChild(el);
  }
}

// bloggerProducts живёт в perfume.js (единый источник), ленивый импорт без циклов:
import { bloggerProducts as _bp } from './perfume.js';
function require_products() { return { bloggerProducts: _bp }; }
void OLFACTORY_ARCHETYPES;
void relativeLuminance;
