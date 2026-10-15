/** Централизованное состояние (активный цвет хранится по id — переживает сортировку). */
export const MAX_PINS = 12;

export const state = {
  algorithm: 'photo', // 'photo' | 'kmeans' | 'mediancut' | 'histogram'
  colorCount: 6,
  minDelta: 28,
  kernelSize: 3,
  sortBy: 'dominance',
  activeFormat: 'hex',
  activeCodeTab: 'css',
  storyTitle: 'Палитра моего дня',
  bloggerPromo: 'БЛОГ10',
  weatherTemp: 20,
  occasion: 'walk',
  showPins: true,
  palette: [],
  sampledPixels: [],
  timings: { decode: 0, sample: 0, cluster: 0, shares: 0, harmony: 0 },
  selectedColorId: null,
  olfactoryProfile: null,
  draggingPinId: null,
  activeHighlightId: null,
  harmonyOpen: false,
  isDemo: true,
  photoLabel: 'Демонстрационный пример'
};

export function selectedColor() {
  if (!state.palette.length) return null;
  const found = state.palette.find((c) => c.id === state.selectedColorId);
  if (found) return found;
  return state.palette[0];
}

export function setSelected(id) {
  state.selectedColorId = id;
}

export function resetPhotoState() {
  // Полный сброс при новом фото: никаких устаревших вердиктов/ролей/рекомендаций.
  state.palette = [];
  state.sampledPixels = [];
  state.selectedColorId = null;
  state.olfactoryProfile = null;
  state.draggingPinId = null;
  state.activeHighlightId = null;
  state.timings = { decode: 0, sample: 0, cluster: 0, shares: 0, harmony: 0 };
}
