/** Only the latest source request may commit a decoded image or report an error. */
export function createPhotoLoader({ decode, commit, onError }) {
  let sequence = 0;
  return {
    invalidate() { sequence++; },
    async load(file) {
      const request = ++sequence;
      const started = performance.now();
      let image;
      try {
        image = await decode(file);
        if (request !== sequence) return;
        await commit(image, file, Math.round(performance.now() - started), () => request === sequence);
      } catch (error) {
        if (request === sequence) onError(error);
      } finally {
        if (image && typeof image.close === 'function') {
          try { image.close(); } catch { /* Already released by the decoder. */ }
        }
      }
    }
  };
}
