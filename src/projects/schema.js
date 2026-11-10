/** Persistent project format. Runtime caches and DOM objects never enter this schema. */
export const SCHEMA_VERSION = 1;
export const MAX_IMAGE_BYTES = 16 * 1024 * 1024;

function check(condition, field) {
  if (!condition) throw new Error(`Invalid project: ${field}`);
}
function text(value, max, field) {
  check(typeof value === 'string' && value.length <= max, field);
  return value;
}
function number(value, min, max, field, integer = false) {
  check(Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value)), field);
  return value;
}
function choice(value, values, field) {
  check(values.includes(value), field);
  return value;
}
function bool(value, field) {
  check(typeof value === 'boolean', field);
  return value;
}

/** Validate and copy only known fields, never merge arbitrary imported keys into state. */
export function validateProject(input) {
  check(input && typeof input === 'object', 'object');
  check(input.schemaVersion === SCHEMA_VERSION, 'schemaVersion');
  const p = input;
  const id = text(p.id, 100, 'id');
  check(id.length > 0, 'id');
  const name = text(p.name, 120, 'name').trim();
  check(name.length > 0, 'name');
  const photo = p.photo;
  check(photo && typeof photo === 'object', 'photo');
  const palette = p.palette;
  check(Array.isArray(palette) && palette.length <= 12, 'palette');
  const ids = new Set();
  const colors = palette.map(c => {
    check(c && typeof c === 'object', 'color');
    const colorId = text(c.id, 100, 'color.id');
    check(/^[A-Za-z0-9_-]+$/.test(colorId) && !ids.has(colorId), 'color.id');
    ids.add(colorId);
    const color = { id: colorId };
    for (const k of ['r', 'g', 'b']) color[k] = number(c[k], 0, 255, k, true);
    for (const k of ['x', 'y']) color[k] = number(c[k], 0, 1, k);
    color.count = number(c.count, 0, 1000000, 'count', true);
    color.percentage = number(c.percentage, 0, 100, 'percentage');
    if (c.center !== undefined) {
      check(c.center && typeof c.center === 'object', 'center');
      color.center = {
        L: number(c.center.L, 0, 1, 'center.L'),
        a: number(c.center.a, -1, 1, 'center.a'),
        b: number(c.center.b, -1, 1, 'center.b')
      };
    }
    if (c.role !== undefined) color.role = text(c.role, 40, 'role');
    if (c.roleNote !== undefined) color.roleNote = text(c.roleNote, 500, 'roleNote');
    return color;
  });
  check(!colors.length || Math.abs(colors.reduce((s, c) => s + c.percentage, 0) - 100) <= 0.11, 'percentage total');
  check(p.selectedColorId === null || ids.has(p.selectedColorId), 'selectedColorId');
  const a = p.analysis, s = p.story;
  check(a && s, 'settings');
  return {
    schemaVersion: SCHEMA_VERSION, id, name,
    ...(p.savedToLibrary !== undefined ? { savedToLibrary: bool(p.savedToLibrary, 'savedToLibrary') } : {}),
    revision: number(p.revision, 0, Number.MAX_SAFE_INTEGER, 'revision', true),
    createdAt: number(p.createdAt, 0, 8640000000000000, 'createdAt', true),
    updatedAt: number(p.updatedAt, p.createdAt, 8640000000000000, 'updatedAt', true),
    photo: {
      width: number(photo.width, 1, 1400, 'width', true),
      height: number(photo.height, 1, 1400, 'height', true),
      label: text(photo.label, 500, 'label'), isDemo: bool(photo.isDemo, 'isDemo')
    },
    palette: colors, selectedColorId: p.selectedColorId,
    analysis: {
      algorithm: choice(a.algorithm, ['photo', 'kmeans', 'mediancut', 'histogram'], 'algorithm'),
      colorCount: number(a.colorCount, 1, 12, 'colorCount', true),
      minDelta: number(a.minDelta, 0, 100, 'minDelta'),
      kernelSize: choice(a.kernelSize, [1, 3, 5], 'kernelSize'),
      sortBy: choice(a.sortBy, ['dominance', 'luminance', 'hue'], 'sortBy')
    },
    ...(p.preferences ? { preferences: {
      activeFormat: choice(p.preferences.activeFormat, ['hex', 'rgb', 'hsl'], 'activeFormat'),
      activeCodeTab: choice(p.preferences.activeCodeTab, ['css', 'json', 'tailwind'], 'activeCodeTab'),
      showPins: bool(p.preferences.showPins, 'showPins'),
      weatherTemp: number(p.preferences.weatherTemp, -15, 35, 'weatherTemp'),
      occasion: choice(p.preferences.occasion, ['office', 'walk', 'date', 'party'], 'occasion'),
      bloggerPromo: text(p.preferences.bloggerPromo, 1000, 'bloggerPromo')
    } } : {}),
    story: {
      template: choice(s.template, ['editorial', 'polaroid', 'magazine', 'aroma'], 'template'),
      title: text(s.title, 1000, 'title'), channel: text(s.channel, 100, 'channel'),
      count: number(s.count, 3, 6, 'story.count', true),
      showNames: bool(s.showNames, 'showNames'), showHex: bool(s.showHex, 'showHex'),
      showPct: bool(s.showPct, 'showPct'), fit: choice(s.fit, ['cover', 'contain'], 'fit'),
      cropX: number(s.cropX, 0, 1, 'cropX'), cropY: number(s.cropY, 0, 1, 'cropY')
    }
  };
}

export function validateImage(blob) {
  check(blob instanceof Blob && blob.type === 'image/png' && blob.size > 0 && blob.size <= MAX_IMAGE_BYTES, 'image');
  return blob;
}

export function projectSummary(project) {
  const { id, name, revision, createdAt, updatedAt } = project;
  return { id, name, revision, createdAt, updatedAt, savedToLibrary: project.savedToLibrary === true,
    colors: project.palette.map(({ r, g, b }) => ({ r, g, b })) };
}
