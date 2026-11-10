import { describe, it, expect } from 'vitest';
import { validateProject, validateImage, MAX_IMAGE_BYTES } from '../src/projects/schema.js';
import { projectFixture } from './project-fixture.js';
import { reservePaletteIds, resetIdCounter, makeId } from '../src/palette.js';

describe('persistent projects', () => {
  it('distinguishes named library entries from autosaved drafts', () => {
    const draft = projectFixture();
    expect(validateProject(draft).savedToLibrary).toBeUndefined();
    draft.savedToLibrary = true;
    expect(validateProject(draft).savedToLibrary).toBe(true);
    draft.savedToLibrary = 'true';
    expect(() => validateProject(draft)).toThrow('savedToLibrary');
  });
  it('reserves restored ids without trusting numeric suffixes', () => {
    resetIdCounter();
    reservePaletteIds([{ id: 'pin-1' }, { id: 'pin-99999999999999999999999999999999999' }]);
    expect(makeId()).toBe('pin-2');
    expect(makeId()).toBe('pin-3');
    resetIdCounter();
  });
  it('preserves display and recommendation preferences', () => {
    const input = projectFixture();
    input.preferences = { activeFormat: 'hsl', activeCodeTab: 'tailwind', showPins: false,
      weatherTemp: -10, occasion: 'date', bloggerPromo: 'МОЙКОД' };
    expect(validateProject(input).preferences).toEqual(input.preferences);
  });
  it('preserves edits, cluster center and crop across JSON round-trip without aliasing', () => {
    const original = projectFixture();
    const restored = validateProject(JSON.parse(JSON.stringify(original)));
    expect(restored).toEqual(original);
    restored.palette[0].center.L = 0.1;
    expect(original.palette[0].center.L).toBe(0.5);
  });
  it('drops runtime and unknown fields', () => {
    const input = projectFixture();
    input.cache = { url: 'blob:expired' };
    input.story.version = 999;
    expect(validateProject(input)).not.toHaveProperty('cache');
    expect(validateProject(input).story).not.toHaveProperty('version');
  });
  it.each([
    p => { p.schemaVersion = 2; },
    p => { p.palette[0].r = NaN; },
    p => { p.palette[0].x = 2; },
    p => { p.palette.push({ ...p.palette[0] }); },
    p => { p.palette[0].percentage = 80; },
    p => { p.selectedColorId = 'missing'; },
    p => { p.story.cropY = -1; },
    p => { p.photo.width = 100000; },
    p => { p.revision = 1.5; },
    p => { p.analysis.sortBy = 'unknown'; }
  ])('rejects invalid data %#', mutate => {
    const input = projectFixture(); mutate(input);
    expect(() => validateProject(input)).toThrow('Invalid project');
  });
  it('accepts PNG blobs and bounds storage input', () => {
    expect(validateImage(new Blob(['png'], { type: 'image/png' })).size).toBe(3);
    expect(() => validateImage(new Blob([], { type: 'image/png' }))).toThrow();
    expect(() => validateImage(new Blob(['x'], { type: 'image/jpeg' }))).toThrow();
    expect(() => validateImage(new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)], { type: 'image/png' }))).toThrow();
  });
});
