import { $, setToggleGroup, createDebounce } from './dom.js';
import { state } from './state.js';
import { renderPerfume } from './ui.js';

export function bindRecommendationControls() {
  const debounce = createDebounce();
  const refresh = () => renderPerfume($('olfactoryHeaderBanner'), $('olfactoryPyramidGrid'), $('weatherAdviceText'), $('matchedPerfumesGrid'), $('perfumeRadarCanvas'));
  $('weatherTempSlider').addEventListener('input', (e) => {
    state.weatherTemp = parseInt(e.target.value, 10);
    $('weatherTempLabel').textContent = `${state.weatherTemp > 0 ? '+' : ''}${state.weatherTemp}°C`;
    debounce(refresh, 120);
  });
  document.querySelectorAll('[data-occasion]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.occasion = btn.dataset.occasion;
      setToggleGroup('occasion', state.occasion);
      refresh();
    });
  });
  $('bloggerPromoInput').addEventListener('input', (e) => { state.bloggerPromo = e.target.value.trim() || 'БЛОГ10'; });

}
