import { copyText } from './story/share.js';

let timer;
export function showToast(text, color = '#f43f5e', label = null) {
  document.getElementById('toastSwatch').style.backgroundColor = color;
  document.getElementById('toastText').textContent = label ? `${label}: ${text}` : text;
  const toast = document.getElementById('toast');
  toast.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

export async function copyWithFeedback(text, color, label) {
  const copied = await copyText(text);
  showToast(text, copied ? color : '#fbbf24', copied ? (label || 'Скопировано') : 'Не удалось скопировать');
  return copied;
}
