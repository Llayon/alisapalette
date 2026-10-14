/**
 * Системная отправка: Web Share API с файловым canShare, честные статусы.
 * Отмена (AbortError) — не ошибка и НЕ запускает fallback-скачивание.
 */

export function shareSupport() {
  const nav = navigator;
  const hasShare = typeof nav.share === 'function';
  let canShareFiles = false;
  try {
    canShareFiles = hasShare && typeof nav.canShare === 'function';
  } catch { canShareFiles = false; }
  return { hasShare, canShareFiles };
}

export function canShareFile(file) {
  try {
    if (!file) return false;
    if (typeof navigator.canShare === 'function') return navigator.canShare({ files: [file] });
    return false;
  } catch {
    return false;
  }
}

/**
 * Вызывать НЕПОСРЕДСТВЕННО в обработчике клика (user activation).
 * Возвращает {status: 'shared'|'cancelled'|'unsupported'|'error', error?}.
 */
export async function shareFile(file, { title, text } = {}) {
  if (!canShareFile(file)) return { status: 'unsupported' };
  try {
    await navigator.share({ files: [file], title, text });
    return { status: 'shared' };
  } catch (e) {
    const name = e && e.name;
    if (name === 'AbortError') return { status: 'cancelled' };
    return { status: 'error', error: name || 'share-failed' };
  }
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fallback */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return !!ok;
  } catch {
    return false;
  }
}
