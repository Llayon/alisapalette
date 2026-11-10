import { validateProject, validateImage } from './schema.js';

export function captureProject(state, story, canvas, identity) {
  return validateProject({
    schemaVersion: 1, ...identity, updatedAt: Math.max(Date.now(), identity.createdAt),
    photo: { width: canvas.width, height: canvas.height, label: state.photoLabel, isDemo: state.isDemo },
    palette: state.palette, selectedColorId: state.palette.some(c => c.id === state.selectedColorId) ? state.selectedColorId : null,
    analysis: state, preferences: state, story
  });
}

export function encodePhoto(canvas) {
  // toBlob snapshots pixels at invocation, before another photo can replace the canvas.
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      try { resolve(validateImage(blob)); } catch (error) { reject(error); }
    }, 'image/png');
  });
}

export async function createProjectPreview(source) {
  const preview = document.createElement('canvas');
  const scale = Math.min(1, 280 / source.width, 180 / source.height);
  preview.width = Math.max(1, Math.round(source.width * scale));
  preview.height = Math.max(1, Math.round(source.height * scale));
  preview.getContext('2d').drawImage(source, 0, 0, preview.width, preview.height);
  return (await encodePhoto(preview)).arrayBuffer();
}

export async function prepareProject(record) {
  const project = validateProject(record.project);
  validateImage(record.image);
  const url = URL.createObjectURL(record.image);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Project image cannot be decoded'));
      img.src = url;
    });
    if (image.naturalWidth !== project.photo.width || image.naturalHeight !== project.photo.height) {
      throw new Error('Project image dimensions do not match');
    }
    const canvas = document.createElement('canvas');
    canvas.width = project.photo.width; canvas.height = project.photo.height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return { project, canvas };
  } finally { URL.revokeObjectURL(url); }
}
