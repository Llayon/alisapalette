/** A single pointer owns the draft crop; cancellation restores its starting point. */
export function bindCropPreview(canvas, state, { onStart, onPreview, onFinish }) {
  let drag = null;
  let frame = null;
  function cancelFrame() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }
  function finish(cancelled, notify = true) {
    if (!drag) return;
    const previous = drag;
    drag = null;
    cancelFrame();
    if (cancelled) {
      state.cropX = previous.cropX;
      state.cropY = previous.cropY;
    }
    try { canvas.releasePointerCapture(previous.id); } catch { /* Synthetic events or lost capture. */ }
    if (notify) onFinish();
  }
  canvas.addEventListener('pointerdown', event => {
    if (drag || state.fit !== 'cover' || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, cropX: state.cropX, cropY: state.cropY };
    onStart();
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Synthetic events. */ }
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    state.cropX = Math.min(1, Math.max(0, drag.cropX + (event.clientX - drag.x) / rect.width));
    state.cropY = Math.min(1, Math.max(0, drag.cropY + (event.clientY - drag.y) / rect.height));
    if (frame === null) frame = requestAnimationFrame(() => { frame = null; onPreview(); });
  });
  canvas.addEventListener('pointerup', event => { if (event.pointerId === drag?.id) finish(false); });
  canvas.addEventListener('pointercancel', event => { if (event.pointerId === drag?.id) finish(true); });
  canvas.addEventListener('lostpointercapture', event => { if (event.pointerId === drag?.id) finish(true); });
  canvas.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drag) {
      event.preventDefault(); event.stopPropagation(); finish(true); return;
    }
    if (drag || state.fit !== 'cover') return;
    const delta = event.shiftKey ? 0.1 : 0.03;
    const directions = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] };
    const direction = directions[event.key];
    if (!direction && event.key !== 'Home') return;
    event.preventDefault();
    onStart();
    if (event.key === 'Home') { state.cropX = 0.5; state.cropY = 0.42; }
    else {
      state.cropX = Math.min(1, Math.max(0, state.cropX + direction[0]));
      state.cropY = Math.min(1, Math.max(0, state.cropY + direction[1]));
    }
    onFinish();
  });
  return { get active() { return drag !== null; }, cancel({ notify = true } = {}) { finish(true, notify); } };
}
