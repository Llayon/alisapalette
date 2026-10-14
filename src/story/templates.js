/**
 * Четыре шаблона Story Studio. Каждый render(ctx, env) возвращает meta:
 * { swatches: [{x,y,w,h,rgb}], texts: [{x,y,w,h}] } — для pixel-тестов.
 * Цвета swatches — точные исходные RGB, без фильтров и наложений.
 */
import { coverRect, containRect, SAFE, rowRects } from './layout.js';
import { wrapLines, setFont } from './typography.js';
import { isValidChannel } from './story-state.js';

export const SERIF = '"Cormorant Garamond", Georgia, serif';
export const SANS = 'Inter, system-ui, sans-serif';
export const MONO = '"JetBrains Mono", ui-monospace, monospace';

function textOn(r, g, b) {
  const L = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return L > 0.45 ? '#1c1917' : '#ffffff';
}

function drawPhoto(ctx, env, box) {
  const { photo } = env;
  if (!photo || !photo.width || !photo.height) {
    ctx.fillStyle = '#292524';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    return;
  }
  if (env.fit === 'contain') {
    ctx.fillStyle = env.photoBg || '#000000';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    const r = containRect(photo.width, photo.height, box.x, box.y, box.w, box.h);
    ctx.drawImage(photo, r.dx, r.dy, r.dw, r.dh);
    return;
  }
  const c = coverRect(photo.width, photo.height, box.w, box.h, env.cropX, env.cropY);
  ctx.drawImage(photo, c.sx, c.sy, c.sw, c.sh, box.x, box.y, box.w, box.h);
}

function drawTitle(ctx, env, x, y, maxW, color, baseSize, align = 'left') {
  const { lines } = wrapLines(ctx, env.title || 'Без названия', maxW, 2);
  setFont(ctx, baseSize, SERIF, '700');
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  const lh = baseSize * 1.12;
  const ax = align === 'center' ? x + maxW / 2 : align === 'right' ? x + maxW : x;
  lines.forEach((ln, i) => ctx.fillText(ln, ax, y + i * lh));
  return { x, y, w: maxW, h: lines.length * lh };
}

function drawFooter(ctx, env, W, H, color, sub) {
  const boxes = [];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const cx = W / 2;
  // Подвал — некритичный брендинг; важный контент выше (см. safe-зону).
  const yBase = H - 200;
  if (env.channel && isValidChannel(env.channel)) {
    setFont(ctx, 34, SANS, '600');
    ctx.fillStyle = color;
    ctx.fillText(env.channel, cx, yBase - 44);
    boxes.push({ x: cx - 300, y: yBase - 80, w: 600, h: 40 });
  }
  setFont(ctx, 30, SANS);
  ctx.fillStyle = sub;
  ctx.fillText('Создано в ChromaStyle', cx, yBase);
  setFont(ctx, 26, SANS);
  ctx.fillText('llayon.github.io/alisapalette', cx, yBase + 40);
  boxes.push({ x: cx - 320, y: yBase - 14, w: 640, h: 60 });
  return boxes;
}

function labelFor(env, c) {
  const parts = [];
  if (env.showNames) parts.push(c.name);
  if (env.showHex) parts.push(c.hex);
  if (env.showPct) parts.push(c.pct.toFixed(1) + '%');
  return parts;
}

// ---------- A: Palette Editorial ----------
function renderEditorial(ctx, env) {
  const { W, H } = env;
  const meta = { swatches: [], texts: [] };
  ctx.fillStyle = '#FAF6F0';
  ctx.fillRect(0, 0, W, H);
  const pad = 72;
  let y = SAFE.top + 10;
  setFont(ctx, 30, SANS, '600');
  ctx.fillStyle = '#a89c8f';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('CHROMASTYLE · ПАЛИТРА КАДРА', pad, y);
  meta.texts.push({ x: pad, y, w: 600, h: 40 });
  y += 56;
  meta.texts.push(drawTitle(ctx, env, pad, y, W - pad * 2, '#1c1917', 92));
  y += 2 * 92 * 1.12 + 36;
  // Фото и ряды делят место до подписной зоны (H-400): без наложений и вылезания.
  const n = env.colors.length;
  const space = Math.max(500, H - 400 - y - 44);
  const photoH = Math.min(700, Math.max(340, Math.round(space * 0.55)));
  const rowsAvail = space - photoH;
  const sh = Math.max(56, Math.floor((rowsAvail - 14 * (n - 1)) / n));
  const box = { x: pad, y, w: W - pad * 2, h: photoH };
  // скругление только фото (не swatches)
  ctx.save();
  roundRectPath(ctx, box.x, box.y, box.w, box.h, 28);
  ctx.clip();
  drawPhoto(ctx, { ...env, photoBg: '#e7ded2' }, box);
  ctx.restore();
  y = box.y + box.h + 44;
  for (const c of env.colors) {
    ctx.fillStyle = c.hex;
    ctx.fillRect(pad, y, 104, sh);
    meta.swatches.push({ x: pad, y, w: 104, h: sh, rgb: [c.r, c.g, c.b] });
    ctx.fillStyle = '#1c1917';
    ctx.textAlign = 'left';
    setFont(ctx, 36, SANS, '600');
    const label = labelFor(env, c)[0] || c.hex;
    const { lines } = wrapLines(ctx, label, W - pad * 2 - 130 - 170, 1);
    ctx.fillText(lines[0] || '', pad + 130, y + 8);
    meta.texts.push({ x: pad + 130, y, w: W - pad * 2 - 300, h: 50 });
    if (env.showPct) {
      setFont(ctx, 34, MONO, '700');
      ctx.fillStyle = '#b0485e';
      ctx.textAlign = 'right';
      ctx.fillText(c.pct.toFixed(1) + '%', W - pad, y + 10);
    }
    if (env.showHex && env.showNames && sh >= 92) {
      setFont(ctx, 28, MONO);
      ctx.fillStyle = '#8a837c';
      ctx.textAlign = 'left';
      ctx.fillText(c.hex, pad + 130, y + 56);
    }
    y += sh + 14;
  }
  meta.texts.push(...drawFooter(ctx, env, W, H, '#57534e', '#a8a29e'));
  return meta;
}

// ---------- B: Polaroid Journal ----------
function renderPolaroid(ctx, env) {
  const { W, H } = env;
  const meta = { swatches: [], texts: [] };
  ctx.fillStyle = '#F1ECE3';
  ctx.fillRect(0, 0, W, H);
  const pad = 84;
  const cardX = pad, cardW = W - pad * 2;
  const photoBox = { x: cardX + 44, y: SAFE.top + 150, w: cardW - 88, h: 760 };
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(60,50,40,0.18)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  ctx.fillRect(cardX, photoBox.y - 40, cardW, photoBox.h + 250);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  drawPhoto(ctx, { ...env, photoBg: '#e7ded2' }, photoBox);
  // подпись как заметка в альбоме
  setFont(ctx, 54, SERIF, '600');
  ctx.fillStyle = '#44403c';
  ctx.textAlign = 'center';
  const { lines } = wrapLines(ctx, env.title || 'Без названия', cardW - 120, 2);
  const lh = 62;
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, photoBox.y + photoBox.h + 44 + i * lh));
  meta.texts.push({ x: cardX, y: photoBox.y + photoBox.h + 30, w: cardW, h: lines.length * lh });
  // полоса палитры
  const stripY = photoBox.y + photoBox.h + 250 + 60;
  const segs = rowRects(cardX, stripY, cardW, 120, env.colors.length, 10);
  env.colors.forEach((c, i) => {
    ctx.fillStyle = c.hex;
    ctx.fillRect(segs[i].x, segs[i].y, segs[i].w, segs[i].h);
    meta.swatches.push({ x: segs[i].x, y: segs[i].y, w: segs[i].w, h: segs[i].h, rgb: [c.r, c.g, c.b] });
  });
  let ly = stripY + 140;
  ctx.textAlign = 'center';
  env.colors.forEach((c, i) => {
    const cxp = segs[i].x + segs[i].w / 2;
    if (env.showHex) {
      setFont(ctx, 26, MONO);
      ctx.fillStyle = '#57534e';
      ctx.fillText(c.hex, cxp, ly);
    }
    // Название — только если реально помещается (без уродливых обрывков)
    if (env.showNames) {
      setFont(ctx, 24, SANS);
      if (ctx.measureText(c.name).width <= segs[i].w + 40) {
        ctx.fillStyle = '#8a837c';
        ctx.fillText(c.name, cxp, ly + (env.showHex ? 32 : 0));
      }
    }
  });
  meta.texts.push({ x: cardX, y: ly - 10, w: cardW, h: 70 });
  meta.texts.push(...drawFooter(ctx, env, W, H, '#78716c', '#a8a29e'));
  return meta;
}

// ---------- C: Modern Magazine ----------
function renderMagazine(ctx, env) {
  const { W, H } = env;
  const meta = { swatches: [], texts: [] };
  ctx.fillStyle = '#141210';
  ctx.fillRect(0, 0, W, H);
  const pad = 64;
  let y = SAFE.top;
  setFont(ctx, 30, MONO, '600');
  ctx.fillStyle = '#f59e0b';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('CHROMASTYLE / COLORS OF THE FRAME', pad, y);
  y += 52;
  // выразительный заголовок
  setFont(ctx, 104, SERIF, '700');
  const { lines } = wrapLines(ctx, (env.title || 'Без названия').toUpperCase(), W - pad * 2, 3);
  ctx.fillStyle = '#fafaf9';
  const lh = 104 * 1.02;
  lines.forEach((ln, i) => ctx.fillText(ln, pad, y + i * lh));
  meta.texts.push({ x: pad, y, w: W - pad * 2, h: lines.length * lh });
  y += lines.length * lh + 30;
  // фото слева, блоки справа — сетка заполняет всё до подписной зоны
  const gridY = y;
  const footerTop = H - 300;
  const availH = Math.max(420, footerTop - 64 - gridY);
  const photoW = Math.round((W - pad * 2) * 0.56);
  const blockH = availH;
  const photoBox = { x: pad, y: gridY, w: photoW, h: blockH };
  drawPhoto(ctx, { ...env, photoBg: '#000' }, photoBox);
  const bx = pad + photoW + 24;
  const bw = W - pad - bx;
  const n = env.colors.length;
  const bh = (blockH - 20 * (n - 1)) / n;
  env.colors.forEach((c, i) => {
    const by = gridY + i * (bh + 20);
    ctx.fillStyle = c.hex;
    ctx.fillRect(bx, by, bw, bh);
    meta.swatches.push({ x: bx, y: by, w: bw, h: bh, rgb: [c.r, c.g, c.b] });
    const fg = textOn(c.r, c.g, c.b);
    ctx.fillStyle = fg;
    ctx.textAlign = 'left';
    const avail = bw - 32;
    let ly = by + 14;
    // Строки показываем только если помещаются в блок (без наложений)
    const put = (text, px, font, mono) => {
      if (ly + px > by + bh - 8) return;
      setFont(ctx, px, mono ? MONO : SANS, '700');
      const { lines } = wrapLines(ctx, text, avail, 1);
      ctx.fillText(lines[0] || '', bx + 16, ly);
      ly += px * 1.15;
    };
    if (env.showPct) put(c.pct.toFixed(0) + '%', Math.min(64, Math.max(34, bh * 0.3)), false);
    if (env.showNames) put(c.name, 30, false);
    if (env.showHex) put(c.hex, 26, true);
  });
  meta.texts.push({ x: bx, y: gridY, w: bw, h: blockH });
  // нижняя подпись
  setFont(ctx, 30, SANS);
  ctx.fillStyle = '#a8a29e';
  ctx.textAlign = 'left';
  const note = 'Фактические цвета кадра · доли измерены локально';
  const { lines: nl } = wrapLines(ctx, note, W - pad * 2, 1);
  ctx.fillText(nl[0], pad, gridY + blockH + 28);
  meta.texts.push(...drawFooter(ctx, env, W, H, '#e7e5e4', '#78716c'));
  return meta;
}

// ---------- D: Aroma Mood ----------
function renderAroma(ctx, env) {
  const { W, H } = env;
  const meta = { swatches: [], texts: [] };
  const prof = env.olfactory || null;
  ctx.fillStyle = '#1c1512';
  ctx.fillRect(0, 0, W, H);
  const pad = 72;
  let y = SAFE.top;
  setFont(ctx, 30, MONO, '600');
  ctx.fillStyle = '#d9a05b';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('CHROMASTYLE · АРОМАТ ДНЯ', pad, y);
  y += 54;
  meta.texts.push(drawTitle(ctx, env, pad, y, W - pad * 2, '#faf6f0', 84));
  y += 2 * 84 * 1.12 + 30;
  // Двухпроходная компоновка: сначала измеряем текстовый блок, потом фото —
  // ничего не вылезает за подписную зону и не налегает.
  const tiers = prof ? [
    ['Верхние ноты', (prof.topNotes || []).join(' · ')],
    ['Сердце', (prof.heartNotes || []).join(' · ')],
    ['База', (prof.baseNotes || []).join(' · ')]
  ] : [];
  const fam = prof ? (() => { setFont(ctx, 40, SERIF, '700'); return wrapLines(ctx, prof.poeticTitle || prof.familyName || '', W - pad * 2, 2); })() : { lines: [] };
  setFont(ctx, 32, SANS);
  const tierLines = tiers.map(([, notes]) => wrapLines(ctx, notes, W - pad * 2, 2).lines.length);
  const top = prof && prof.topPerfumes && prof.topPerfumes[0];
  const textBlock = fam.lines.length * 46 + 18
    + tierLines.reduce((s, k) => s + 34 + k * 40 + 14, 0)
    + (top ? 34 + 52 : 52) + 96 + 40;
  const photoH = Math.min(640, Math.max(380, H - 420 - textBlock - y));
  const photoBox = { x: pad, y, w: W - pad * 2, h: photoH };
  ctx.save();
  roundRectPath(ctx, photoBox.x, photoBox.y, photoBox.w, photoBox.h, 24);
  ctx.clip();
  drawPhoto(ctx, { ...env, photoBg: '#2a211c' }, photoBox);
  ctx.restore();
  y = photoBox.y + photoBox.h + 36;
  if (prof) {
    // Только реально рассчитанные данные: имена нот и парфюм. Без % совместимости.
    setFont(ctx, 40, SERIF, '700');
    ctx.fillStyle = '#f5e8d5';
    ctx.textAlign = 'left';
    fam.lines.forEach((ln, i) => ctx.fillText(ln, pad, y + i * 46));
    meta.texts.push({ x: pad, y, w: W - pad * 2, h: fam.lines.length * 46 });
    y += fam.lines.length * 46 + 18;
    tiers.forEach(([label, notes], ti) => {
      setFont(ctx, 26, MONO, '600');
      ctx.fillStyle = '#d9a05b';
      ctx.fillText(label.toUpperCase(), pad, y);
      y += 34;
      setFont(ctx, 32, SANS);
      ctx.fillStyle = '#e7e5e4';
      const w = wrapLines(ctx, notes, W - pad * 2, 2);
      w.lines.forEach((ln, i) => ctx.fillText(ln, pad, y + i * 40));
      y += tierLines[ti] * 40 + 14;
    });
    if (top) {
      setFont(ctx, 26, MONO, '600');
      ctx.fillStyle = '#a8a29e';
      ctx.fillText('АССОЦИАЦИЯ · НЕ РЕКОМЕНДАЦИЯ К ПОКУПКЕ', pad, y);
      y += 34;
      setFont(ctx, 38, SANS, '600');
      ctx.fillStyle = '#faf6f0';
      const pn = wrapLines(ctx, `${top.brand} — ${top.name}`, W - pad * 2, 1);
      ctx.fillText(pn.lines[0] || '', pad, y);
      y += 52;
    }
    meta.texts.push({ x: pad, y: photoBox.y + photoBox.h + 30, w: W - pad * 2, h: y - photoBox.y - photoBox.h - 30 });
  } else {
    setFont(ctx, 32, SANS);
    ctx.fillStyle = '#e7e5e4';
    ctx.fillText('Настроение кадра — в его цветах.', pad, y);
    y += 52;
  }
  // мини-полоса палитры (точные цвета)
  const segs = rowRects(pad, y, W - pad * 2, 96, env.colors.length, 8);
  env.colors.forEach((c, i) => {
    ctx.fillStyle = c.hex;
    ctx.fillRect(segs[i].x, segs[i].y, segs[i].w, segs[i].h);
    meta.swatches.push({ x: segs[i].x, y: segs[i].y, w: segs[i].w, h: segs[i].h, rgb: [c.r, c.g, c.b] });
  });
  meta.texts.push(...drawFooter(ctx, env, W, H, '#d6c7b4', '#8a837c'));
  return meta;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export const TEMPLATES = {
  editorial: { id: 'editorial', name: 'Editorial', desc: 'Минимализм: воздух, serif, 5 образцов', render: renderEditorial },
  polaroid: { id: 'polaroid', name: 'Polaroid', desc: 'Бумага, рамка, полоса палитры', render: renderPolaroid },
  magazine: { id: 'magazine', name: 'Magazine', desc: 'Смелый журнал: блоки + проценты', render: renderMagazine },
  aroma: { id: 'aroma', name: 'Aroma', desc: 'Аромат дня: ноты и ассоциация', render: renderAroma }
};

export function templateIds() {
  return Object.keys(TEMPLATES);
}
