import { validateProject, validateImage, MAX_IMAGE_BYTES, SCHEMA_VERSION } from './schema.js';

export const FILE_FORMAT = 'chromastyle-project';
export const FILE_VERSION = 1;
export const MAX_PROJECT_FILE_BYTES = 24 * 1024 * 1024;
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

function invalid(message = 'Данные проекта повреждены или имеют неподдерживаемый формат.') {
  throw new Error(message);
}
function projectData(input) {
  if (input?.schemaVersion !== SCHEMA_VERSION) invalid('Эта версия данных проекта пока не поддерживается.');
  try { return validateProject(input); } catch { invalid(); }
}
function checkPng(bytes, photo) {
  if (bytes.byteLength < 33 || !pngSignature.every((v, i) => bytes[i] === v)) invalid('Изображение проекта повреждено: нужен PNG.');
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (data.getUint32(8) !== 13 || String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') invalid();
  const width = data.getUint32(16), height = data.getUint32(20);
  if (!width || !height || width > 1400 || height > 1400 || width !== photo.width || height !== photo.height) {
    invalid('Размер изображения не соответствует проекту или превышает 1400 пикселей.');
  }
}
function toBase64(bytes) {
  const chunks = [];
  for (let i = 0; i < bytes.length; i += 32768) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
  return btoa(chunks.join(''));
}
function fromBase64(value) {
  if (typeof value !== 'string' || !value.length || value.length % 4 || value.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) invalid('Изображение проекта слишком велико или повреждено.');
  if (/[^A-Za-z0-9+/=]/.test(value)) invalid();
  const pad = value.indexOf('=');
  if (pad !== -1 && !['=', '=='].includes(value.slice(pad))) invalid();
  let decoded;
  try { decoded = atob(value); } catch { invalid(); }
  if (decoded.length > MAX_IMAGE_BYTES) invalid('Изображение проекта слишком велико.');
  return Uint8Array.from(decoded, c => c.charCodeAt(0));
}

export async function exportProjectFile(record) {
  const project = projectData(record.project);
  const bytes = new Uint8Array(await validateImage(record.image).arrayBuffer());
  checkPng(bytes, project.photo);
  const file = new Blob([JSON.stringify({
    format: FILE_FORMAT, formatVersion: FILE_VERSION, project,
    image: { type: 'image/png', encoding: 'base64', data: toBase64(bytes) }
  })], { type: 'application/json' });
  if (file.size > MAX_PROJECT_FILE_BYTES) invalid('Файл проекта превышает 24 МБ.');
  return { blob: file, filename: projectFilename(project.name) };
}

/** Only parses bounded data. The controller also decodes the PNG before any database write. */
export async function readProjectFile(file) {
  if (!(file instanceof Blob) || !file.size) invalid('Выберите непустой файл .chromastyle.json.');
  if (file.size > MAX_PROJECT_FILE_BYTES) invalid('Файл проекта превышает 24 МБ.');
  let input;
  try { input = JSON.parse((await file.text()).replace(/^\uFEFF/, '')); }
  catch { invalid('Не удалось прочитать JSON. Выберите файл .chromastyle.json.'); }
  if (input?.format !== FILE_FORMAT) invalid('Это не файл проекта ChromaStyle.');
  if (input.formatVersion !== FILE_VERSION) invalid('Эта версия файла проекта пока не поддерживается.');
  const project = projectData(input.project);
  if (input.image?.type !== 'image/png' || input.image.encoding !== 'base64') invalid();
  const bytes = fromBase64(input.image.data);
  checkPng(bytes, project.photo);
  return { project, image: new Blob([bytes], { type: 'image/png' }) };
}

export function projectFilename(name) {
  const slug = String(name).normalize('NFC').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return `chromastyle-${slug || 'palette'}.chromastyle.json`;
}
