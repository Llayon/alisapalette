/** Application entry point: initialize and connect the feature controllers. */
import './styles.css';
import { $, setToggle, setToggleGroup } from './dom.js';
import { state } from './state.js';
import { restoreStory } from './story/story-state.js';
import { haptic, copyToClipboard } from './feedback.js';
import { createStoryStudio } from './story/controller.js';
import { createPaletteController } from './palette-controller.js';
import { createPhotoController } from './photo-controller.js';
import { bindRecommendationControls } from './recommendations-controller.js';
import { state as story } from './story/story-state.js';
import { createProjectController } from './projects/controller.js';

const mainCanvas = $('mainCanvas');
let projects;
const storyStudio = createStoryStudio({ mainCanvas, haptic, copyToClipboard });
const palette = createPaletteController({
  mainCanvas, haptic, copyToClipboard,
  analyzeImagePalette: () => photo.analyzeImagePalette(),
  onPaletteChange: () => { storyStudio.syncPalette(); projects?.changed(); }
});
const photo = createPhotoController({ mainCanvas, palette, storyStudio, haptic,
  onBeforePhotoChange: isCurrent => projects?.preparePhotoChange(isCurrent), onPhotoChange: () => projects?.newPhoto() });
projects = createProjectController({ state, story, canvas: mainCanvas, photo, palette, storyStudio });
bindRecommendationControls();

window.copyToClipboard = copyToClipboard;
window.__chromastyle = state;

$('propDetailsBtn').addEventListener('click', () => {
  const det = $('moreProportion');
  det.open = true;
  det.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

window.addEventListener('DOMContentLoaded', () => {
  setToggleGroup('algo', state.algorithm);
  document.querySelectorAll('[data-format], [data-kernel], [data-occasion], [data-code]').forEach(button => setToggle(button, button.classList.contains('on')));
  restoreStory();
  projects.start();
});
