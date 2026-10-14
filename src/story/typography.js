/**
 * Story typography: переносы и подгонка без .slice(). Чистые функции.
 * ctx — любой объект с measureText (реальный Canvas или мок в тестах).
 */

export function splitLongWord(ctx, word, maxWidth) {
  const parts = [];
  let cur = '';
  for (const ch of word) {
    const t = cur + ch;
    if (ctx.measureText(t).width <= maxWidth || !cur) cur = t;
    else { parts.push(cur); cur = ch; }
  }
  if (cur) parts.push(cur);
  return parts;
}

/**
 * Перенос по словам, максимум maxLines строк. Длинные слова режутся посимвольно.
 * Возвращает {lines, truncated}. Никогда не выходит за maxWidth (в пределах
 * точности measureText).
 */
export function wrapLines(ctx, text, maxWidth, maxLines = 2) {
  const out = [];
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  if (!words.length) return { lines: [], truncated: false };
  let truncated = false;
  let line = '';
  const pushLine = (l) => {
    if (out.length >= maxLines) { truncated = true; return false; }
    out.push(l);
    return true;
  };
  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) {
      if (!pushLine(line)) { truncated = true; break; }
      line = '';
    }
    // Слово не влезает даже в пустую строку
    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
    } else {
      const parts = splitLongWord(ctx, word, maxWidth);
      for (let i = 0; i < parts.length; i++) {
        if (i < parts.length - 1) {
          if (!pushLine(parts[i])) { truncated = true; break; }
        } else line = parts[i];
      }
      if (truncated) break;
    }
  }
  if (line && out.length < maxLines) out.push(line);
  else if (line) truncated = true;
  // Многоточие при обрезке
  if (truncated && out.length) {
    let last = out[out.length - 1];
    while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
    out[out.length - 1] = last + '…';
  }
  return { lines: out, truncated };
}

/** Уменьшение кегля, чтобы однострочник влез в maxWidth. Возвращает кегль. */
export function fitFontSize(ctx, text, maxWidth, base, min, font) {
  let size = base;
  while (size > min) {
    ctx.font = `${size}px ${font}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.font = `${size}px ${font}`;
  return size;
}

export function setFont(ctx, px, family, weight = '') {
  ctx.font = `${weight ? weight + ' ' : ''}${px}px ${family}`;
}
