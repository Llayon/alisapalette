import { describe, it, expect } from 'vitest';
import { propose603010 } from '../src/ui.js';

const C = (n, percentage, c) => ({ r: n * 10 % 256, g: n * 20 % 256, b: n * 30 % 256, percentage, n: 'X' + n, _C: c });

describe('propose603010: роли без дублей (аудит 1b)', () => {
  it('один цвет: компаньон и акцент честно отсутствуют', () => {
    const r = propose603010([{ r: 200, g: 200, b: 200, percentage: 100 }]);
    expect(r.text).toContain('можно добавить');
    expect(r.detail).toContain('компаньона в кадре нет');
    expect(r.detail).toContain('акцента в кадре нет');
  });
  it('два цвета 70/30: акцент не дублирует компаньона', () => {
    const A = { r: 240, g: 240, b: 240, percentage: 70 };
    const B = { r: 150, g: 30, b: 40, percentage: 30 };
    const r = propose603010([A, B]);
    expect(r.text).toContain('Компаньон');
    expect(r.text).toContain('Акцент ~10%: в кадре нет отдельного малого оттенка');
    // Один и тот же HEX не встречается в двух ролях
    const hexes = [...r.text.matchAll(/#[0-9A-F]{6}/g)].map((m) => m[0]);
    expect(new Set(hexes).size).toBe(hexes.length);
  });
  it('три цвета: все роли разные, доли факт vs цель разделены', () => {
    const A = { r: 200, g: 200, b: 200, percentage: 61 };
    const B = { r: 150, g: 150, b: 151, percentage: 33 };
    const Cc = { r: 150, g: 30, b: 40, percentage: 6 };
    const r = propose603010([A, B, Cc]);
    const hexes = [...r.text.matchAll(/#[0-9A-F]{6}/g)].map((m) => m[0]);
    expect(hexes.length).toBe(3);
    expect(new Set(hexes).size).toBe(3);
    expect(r.detail).toContain('цель ~60%');
    expect(r.detail).toContain('рекомендация');
  });
  it('пустая палитра: безопасный ответ', () => {
    expect(propose603010([]).text).toBe('—');
  });
  void C;
});
