/** Procedural examples share the same loading/analysis path as a user's photo. */
export function createDemoScene(type) {
  const canvas = document.createElement('canvas');
  const w = canvas.width = 800, h = canvas.height = 600;
  const ctx = canvas.getContext('2d');
  const rect = (color, ...args) => { ctx.fillStyle = color; ctx.fillRect(...args); };
  const shape = (color, method, ...args) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    (ctx[method] || ctx.rect).call(ctx, ...args);
    ctx.fill();
  };
  const circle = (color, x, y, radius) => shape(color, 'arc', x, y, radius, 0, Math.PI * 2);
  const ellipse = (color, x, y, rx, ry, rotation) => shape(color, 'ellipse', x, y, rx, ry, rotation, 0, Math.PI * 2);
  const gradient = stops => {
    const color = ctx.createLinearGradient(0, 0, w, h);
    stops.forEach(([offset, value]) => color.addColorStop(offset, value));
    rect(color, 0, 0, w, h);
  };
  if (type === 'coffee') {
    rect('#EAE0D2', 0, 0, w, h);
    ctx.fillStyle = '#D8C6B4';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.65, 0); ctx.lineTo(w * 0.25, h); ctx.lineTo(0, h); ctx.fill();
    circle('#F8F1E5', w * 0.36, h * 0.56, 150);
    ellipse('#C6864E', w * 0.36, h * 0.55, 95, 52, -0.25);
    ellipse('#9C623E', w * 0.36, h * 0.55, 65, 32, -0.25);
    circle('#3E2920', w * 0.7, h * 0.42, 95);
    circle('#AF8A6C', w * 0.7, h * 0.42, 78);
    circle('#F8F1E5', w * 0.7, h * 0.40, 34);
    ellipse('#8EA592', w * 0.22, h * 0.22, 48, 24, 0.4);
    ellipse('#8EA592', w * 0.31, h * 0.18, 42, 22, -0.3);
  } else if (type === 'ootd') {
    rect('#F5F5F4', 0, 0, w, h);
    rect('#BDA285', 40, 40, 360, 520);
    rect('#F8F1E5', 280, 70, 240, 260);
    rect('#4A7098', 430, 250, 320, 310);
    shape('#621626', 'roundRect', 240, 360, 190, 140, 28);
  } else if (type === 'flowers') {
    gradient([[0, '#F4DBD8'], [1, '#EAE0D2']]);
    circle('#E8A5B2', w * 0.38, h * 0.45, 130);
    circle('#C48A91', w * 0.58, h * 0.38, 105);
    circle('#8A1C30', w * 0.48, h * 0.68, 65);
    rect('#8EA592', w * 0.15, h * 0.65, 160, 95);
  } else if (type === 'gray') {
    gradient([[0, '#cfcfcf'], [0.5, '#b9b9bb'], [1, '#8f9092']]);
    rect('#6f7072', w * 0.4, h * 0.35, w * 0.2, h * 0.3);
  } else {
    rect('#F8F1E5', 0, 0, w, h * 0.68);
    rect('#764E38', 0, h * 0.68, w, h * 0.32);
    shape('#76804E', 'roundRect', 70, h * 0.38, 380, 240, 24);
    circle('#C26248', w * 0.74, h * 0.54, 98);
    shape('#A4C6E4', 'roundRect', 140, h * 0.42, 145, 135, 20);
  }
  const label = { coffee: 'Пример: утренний латте', ootd: 'Пример: образ дня', flowers: 'Пример: пионы', gray: 'Пример: почти серое', interior: 'Пример: уютный дом' }[type] || 'Демонстрационный пример';
  return { canvas, label };
}
