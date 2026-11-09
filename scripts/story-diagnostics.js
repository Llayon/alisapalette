/** Test/report helpers, installed before navigation; excluded from the app bundle. */
export function installStoryDiagnostics() {
  window.__installStoryDiagnostics = render => {
    // Тестовые хуки: лёгкий meta-рендер и contact-sheet монтаж (2×2) как dataURL.
    window.__storyShot = (template, W = 540, H = 960) => {
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const c = cv.getContext('2d', { willReadFrequently: true });
      const meta = render(c, W, H, template);
      return { meta, W, H };
    };
    window.__storyMontage = (templates, cw = 270, ch = 480) => {
      const grid = document.createElement('canvas');
      grid.width = cw * 2; grid.height = ch * 2;
      const g = grid.getContext('2d');
      g.fillStyle = '#0c0a09';
      g.fillRect(0, 0, grid.width, grid.height);
      templates.slice(0, 4).forEach((t, i) => {
        const cv = document.createElement('canvas');
        cv.width = cw; cv.height = ch;
        render(cv.getContext('2d'), cw, ch, t);
        g.drawImage(cv, (i % 2) * cw, Math.floor(i / 2) * ch, cw, ch);
      });
      return grid.toDataURL('image/png');
    };
    window.__storyCheck = (template) => {
      const W = 540, H = 960;
      const K = W / 1080; // meta — в пространстве 1080×1920
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const c = cv.getContext('2d', { willReadFrequently: true });
      const meta = render(c, W, H, template);
      const data = c.getImageData(0, 0, W, H).data;
      const at = (x, y) => {
        const i = (Math.round(y * K) * W + Math.round(x * K)) * 4;
        return [data[i], data[i + 1], data[i + 2], data[i + 3]];
      };
      const swatches = (meta.swatches || []).map((s) => {
        // центр swatch (вдали от скруглений — swatches всегда прямоугольники)
        const px = at(s.x + s.w / 2, s.y + s.h / 2);
        return { want: s.rgb, got: px.slice(0, 3), ok: Math.abs(px[0] - s.rgb[0]) <= 2 && Math.abs(px[1] - s.rgb[1]) <= 2 && Math.abs(px[2] - s.rgb[2]) <= 2 };
      });
      let opaque = 0;
      for (let i = 3; i < data.length; i += 40) if (data[i] > 128) opaque++;
      const textsSafe = (meta.texts || []).map((t) => (
        t.x >= -1 && t.y >= -1 && (t.x + t.w) <= 1080 + 1 && (t.y + t.h) <= 1920 + 1
      ));
      return {
        swatches, opaqueRatio: opaque / (data.length / 40),
        textsInsideCanvas: textsSafe.every(Boolean),
        swatchCount: swatches.length,
        allSwatchesOk: swatches.length > 0 && swatches.every((s) => s.ok)
      };
    };

  };
}
