/**
 * Четыре шаблона Story Studio возвращают геометрию образцов цвета.
 * Общий renderer добавляет фактические границы всех нарисованных текстов.
 * Цвета swatches — точные исходные RGB, без фильтров и наложений.
 */
import { coverRect, containRect, SAFE, rowRects } from './layout.js';
import { wrapLines, setFont } from './typography.js';
import { isValidChannel } from './story-state.js';
import { textOnColor } from '../color-science.js';

export const SERIF = '"Cormorant Garamond", Georgia, serif';
export const SANS = 'Inter, system-ui, sans-serif';
export const MONO = '"JetBrains Mono", ui-monospace, monospace';

function textOn(r, g, b) {
  return textOnColor({ r, g, b });
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
  setFont(ctx, baseSize, SERIF, '700');
  const { lines } = wrapLines(ctx, env.title || 'Без названия', maxW, 2);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  const lh = baseSize * 1.12;
  const ax = align === 'center' ? x + maxW / 2 : align === 'right' ? x + maxW : x;
  lines.forEach((line, i) => ctx.fillText(line, ax, y + i * lh));
}

function drawFooter(ctx, env, W, H, color, sub) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const cx = W / 2;
  // Подвал — некритичный брендинг; важный контент выше (см. safe-зону).
  const yBase = H - 200;
  if (env.channel && isValidChannel(env.channel)) {
    let size = 34;
    do {
      setFont(ctx, size, SANS, '600');
      if (ctx.measureText(env.channel).width <= W - SAFE.left - SAFE.right) break;
      size--;
    } while (size >= 18);
    ctx.fillStyle = color;
    ctx.fillText(env.channel, cx, yBase - 44);
  }
  setFont(ctx, 30, SANS);
  ctx.fillStyle = sub;
  ctx.fillText('Создано в ChromaStyle', cx, yBase);
  setFont(ctx, 26, SANS);
  ctx.fillText('llayon.github.io/alisapalette', cx, yBase + 40);
}

function drawSwatchLabels(ctx, env, color, rect, top, foreground) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = foreground;
  const x = rect.x + rect.w / 2;
  let y = top;
  if (env.showHex) { setFont(ctx, 26, MONO); ctx.fillText(color.hex, x, y); y += 32; }
  if (env.showNames) {
    const size = rect.w < 200 ? 20 : 24;
    setFont(ctx, size, SANS);
    const { lines } = wrapLines(ctx, color.name, rect.w - 8, 3);
    for (const line of lines) { ctx.fillText(line, x, y); y += Math.ceil(size * 1.2); }
  }
  if (env.showPct) { setFont(ctx, 24, MONO); ctx.fillText(color.pct.toFixed(1) + '%', x, y + 4); }
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
  y += 56;
  drawTitle(ctx, env, pad, y, W - pad * 2, '#1c1917', 92);
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
    const label = env.showNames ? c.name : env.showHex ? c.hex : '';
    const primarySize = sh >= 80 ? 36 : 26;
    setFont(ctx, primarySize, env.showNames ? SANS : MONO, '600');
    const { lines } = wrapLines(ctx, label, W - pad * 2 - 130 - (env.showPct ? 170 : 0), 1);
    if (lines.length) ctx.fillText(lines[0], pad + 130, y + 4);
    if (env.showPct) {
      setFont(ctx, 30, MONO, '700');
      ctx.fillStyle = '#b0485e'; ctx.textAlign = 'right';
      ctx.fillText(c.pct.toFixed(1) + '%', W - pad, y + 8);
    }
    if (env.showHex && env.showNames) {
      setFont(ctx, sh >= 80 ? 28 : 22, MONO);
      ctx.fillStyle = '#57534e'; ctx.textAlign = 'left';
      ctx.fillText(c.hex, pad + 130, y + primarySize * 1.15 + 4);
    }
    y += sh + 14;
  }
  drawFooter(ctx, env, W, H, '#57534e', '#a8a29e');
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
  // полоса палитры
  const stripY = photoBox.y + photoBox.h + 210;
  const segs = rowRects(cardX, stripY, cardW, 120, env.colors.length, 10);
  env.colors.forEach((c, i) => {
    ctx.fillStyle = c.hex;
    ctx.fillRect(segs[i].x, segs[i].y, segs[i].w, segs[i].h);
    meta.swatches.push({ x: segs[i].x, y: segs[i].y, w: segs[i].w, h: segs[i].h, rgb: [c.r, c.g, c.b] });
  });
  env.colors.forEach((c, i) => drawSwatchLabels(ctx, env, c, segs[i], stripY + 140, '#57534e'));
  drawFooter(ctx, env, W, H, '#78716c', '#a8a29e');
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
    const put = (text, px, mono = false, maxLines = 1) => {
      if (ly + px > by + bh - 8) return;
      setFont(ctx, px, mono ? MONO : SANS, '700');
      const { lines } = wrapLines(ctx, text, avail, maxLines);
      for (const line of lines) {
        if (ly + px > by + bh - 8) break;
        ctx.fillText(line, bx + 16, ly);
        ly += px * 1.15;
      }
    };
    if (env.showPct) put(c.pct.toFixed(1) + '%', Math.min(64, Math.max(26, bh * 0.22)), false);
    if (env.showNames) put(c.name, 24, false, 2);
    if (env.showHex) put(c.hex, 24, true);
  });
  // нижняя подпись
  setFont(ctx, 30, SANS);
  ctx.fillStyle = '#a8a29e';
  ctx.textAlign = 'left';
  const note = 'Фактические цвета кадра · доли измерены локально';
  const { lines: nl } = wrapLines(ctx, note, W - pad * 2, 1);
  ctx.fillText(nl[0], pad, gridY + blockH + 28);
  drawFooter(ctx, env, W, H, '#e7e5e4', '#78716c');
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
  drawTitle(ctx, env, pad, y, W - pad * 2, '#faf6f0', 84);
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
    + (top ? 34 + 52 : 52) + 96 + 40 + 150;
  const photoH = Math.min(640, Math.max(280, H - 420 - textBlock - y));
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
  env.colors.forEach((c, i) => drawSwatchLabels(ctx, env, c, segs[i], y + 116, '#d6c7b4'));
  drawFooter(ctx, env, W, H, '#d6c7b4', '#8a837c');
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
  editorial: renderEditorial,
  polaroid: renderPolaroid,
  magazine: renderMagazine,
  aroma: renderAroma
};

export function templateIds() {
  return Object.keys(TEMPLATES);
}
