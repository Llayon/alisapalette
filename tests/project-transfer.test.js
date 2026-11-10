import { describe, it, expect, vi } from 'vitest';
import { exportProjectFile, readProjectFile, projectFilename, MAX_PROJECT_FILE_BYTES } from '../src/projects/transfer.js';
import { projectFixture } from './project-fixture.js';

const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5h8AAAAASUVORK5CYII='), c => c.charCodeAt(0));
function record() {
  const project = projectFixture();
  project.photo.width = project.photo.height = 1;
  return { project, image: new Blob([png], { type: 'image/png' }) };
}
async function envelope() { return JSON.parse(await (await exportProjectFile(record())).blob.text()); }
const fileOf = input => new Blob([JSON.stringify(input)], { type: 'application/json' });

describe('project file transfer', () => {
  it('preserves binary data across base64 chunk boundaries', async () => {
    const bytes = Uint8Array.from({ length: 100003 }, (_, i) => i % 256);
    bytes.set(png);
    const input = record(); input.image = new Blob([bytes], { type: 'image/png' });
    const output = await readProjectFile((await exportProjectFile(input)).blob);
    expect(new Uint8Array(await output.image.arrayBuffer())).toEqual(bytes);
  });
  it('round-trips project data and original PNG bytes, stripping runtime fields', async () => {
    const original = record(); original.project.cache = { url: 'blob:expired' };
    const file = await exportProjectFile(original);
    const restored = await readProjectFile(file.blob);
    expect(restored.project).toEqual(projectFixtureWithDimensions());
    expect(new Uint8Array(await restored.image.arrayBuffer())).toEqual(png);
    expect(file.filename).toMatch(/\.chromastyle\.json$/);
    expect(restored.project).not.toHaveProperty('cache');
  });
  it('accepts UTF-8 BOM and preserves Cyrillic', async () => {
    const input = await envelope();
    const restored = await readProjectFile(new Blob(['\uFEFF', JSON.stringify(input)]));
    expect(restored.project.name).toBe('Моя палитра');
  });
  it.each([
    input => { input.format = 'another-app'; },
    input => { input.formatVersion = 2; },
    input => { input.project.schemaVersion = 2; },
    input => { input.project.palette[0].r = 256; },
    input => { input.project.palette[0].id = 'pin"]'; },
    input => { input.project.updatedAt = Number.MAX_SAFE_INTEGER; },
    input => { input.project.story.cropX = -1; },
    input => { input.image.type = 'image/svg+xml'; },
    input => { input.image.encoding = 'url'; },
    input => { input.image.data = 'https://example.com/image.png'; },
    input => { input.image.data = 'abc'; },
    input => { input.image.data = 'a===AAAA'; },
    input => { input.image.data = btoa('not a png image'); },
    input => { input.project.photo.width = 2; },
    input => {
      const bytes = Uint8Array.from(png); new DataView(bytes.buffer).setUint32(16, 50000);
      input.image.data = btoa(String.fromCharCode(...bytes));
    }
  ])('rejects unsupported or damaged input %#', async change => {
    const input = await envelope(); change(input);
    await expect(readProjectFile(fileOf(input))).rejects.toThrow();
  });
  it('rejects oversized input before reading it', async () => {
    class Oversized extends Blob { get size() { return MAX_PROJECT_FILE_BYTES + 1; } }
    const file = new Oversized();
    const read = vi.spyOn(file, 'text');
    await expect(readProjectFile(file)).rejects.toThrow('24 МБ');
    expect(read).not.toHaveBeenCalled();
  });
  it('rejects empty files and malformed JSON', async () => {
    await expect(readProjectFile(new Blob([]))).rejects.toThrow('непустой');
    await expect(readProjectFile(new Blob(['{']))).rejects.toThrow('JSON');
  });
  it('does not include traversal or platform filename characters', () => {
    expect(projectFilename('../../CON:<палитра> /\\')).toBe('chromastyle-CON-палитра.chromastyle.json');
    expect(projectFilename('...')).toBe('chromastyle-palette.chromastyle.json');
  });
});

function projectFixtureWithDimensions() { const p = projectFixture(); p.photo.width = p.photo.height = 1; return p; }
