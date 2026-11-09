import { copyWithFeedback } from './notifications.js';

const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
try { tg && tg.ready && tg.ready(); tg && tg.expand && tg.expand(); } catch { /* noop */ }

export function haptic(type = 'light') {
  try {
    if (tg && tg.HapticFeedback) {
      if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
      else tg.HapticFeedback.impactOccurred(type);
    } else if (navigator.vibrate) navigator.vibrate(type === 'success' ? [12, 30, 12] : 8);
  } catch { /* noop */ }
}

export async function copyToClipboard(text, previewHex = '#f43f5e', label = null) {
  const copied = await copyWithFeedback(text, previewHex, label);
  if (copied) haptic('success');
  return copied;
}
