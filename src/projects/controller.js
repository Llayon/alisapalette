import { createProjectStorage } from './storage.js';
import { captureProject, encodePhoto, prepareProject, createProjectPreview } from './snapshot.js';
import { $, setToggleGroup } from '../dom.js';
import { createProjectLibrary } from './view.js';
import { exportProjectFile, readProjectFile } from './transfer.js';

export function createProjectController({ state, story, canvas, photo, palette, storyStudio }) {
  const storage = createProjectStorage();
  const status = $('projectSaveStatus');
  const retry = $('retryProjectSave');
  const copy = $('copyConflictedProject');
  const reload = $('reloadProject');
  let current, timer, queue = Promise.resolve(), restoring = false, started = false;
  let interaction = 0;
  const failed = new Map();
  const identity = () => ({ id: crypto.randomUUID(), name: state.photoLabel.slice(0, 120) || 'Моя палитра',
    createdAt: Date.now(), revision: 0, savedToLibrary: false });
  function report(text) {
    status.textContent = text;
    retry.hidden = !failed.size;
    copy.hidden = ![...failed.values()].some(task => task.owner.conflict);
    reload.hidden = !current?.conflict;
  }
  function newPhoto() {
    if (restoring) return;
    interaction++;
    if (!started) return;
    current = { identity: identity(), image: null, signature: '', revision: null };
    changed();
  }
  function changed() {
    if (!started || restoring || !current) return;
    clearTimeout(timer);
    current.changeVersion = (current.changeVersion || 0) + 1;
    report(current.conflict ? 'Конфликт: проект изменён в другой вкладке' : 'Есть изменения');
    timer = setTimeout(flush, 450);
  }
  function flush() {
    clearTimeout(timer);
    if (!current || restoring) return queue;
    if (state.draggingPinId || storyStudio.editing) { timer = setTimeout(flush, 200); return queue; }
    const owner = current;
    let snapshot;
    try { snapshot = captureProject(state, story, canvas, owner.identity); }
    catch { report('Не удалось подготовить сохранение'); return queue; }
    const signature = JSON.stringify({ ...snapshot, updatedAt: 0, revision: 0 });
    if (signature === owner.signature) {
      if (!failed.size) report('Сохранено на устройстве');
      return queue;
    }
    if (!owner.image) {
      owner.image = encodePhoto(canvas);
      // Encoding may reject before its queued turn; retain that failure for the writer.
      owner.image.catch(() => {});
    }
    owner.preview ||= createProjectPreview(canvas).catch(() => undefined);
    const task = { owner, snapshot, signature, image: owner.image, changeVersion: owner.changeVersion };
    if (owner.conflict) { failed.set(owner.identity.id, task); return queue; }
    enqueue(task);
    return queue;
  }
  function enqueue(task) {
    queue = queue.then(async () => {
      const { owner, snapshot, signature } = task;
      if (owner.deleted) return;
      if (owner.conflict) { failed.set(owner.identity.id, task); return; }
      if (owner === current) report('Сохраняется…');
      try {
        const saved = await storage.save(snapshot, owner.revision === null ? await task.image : undefined,
          owner.revision, { makeCurrent: owner === current, previewBytes: await owner.preview });
        owner.revision = saved.revision;
        owner.identity.revision = saved.revision;
        owner.signature = signature;
        failed.delete(owner.identity.id);
        if (owner === current) report(failed.size ? 'Есть несохранённые работы. Повторите сохранение'
          : owner.changeVersion !== task.changeVersion ? 'Есть изменения' : 'Сохранено на устройстве');
      } catch (error) {
        failed.set(owner.identity.id, task);
        owner.conflict = error.name === 'ProjectConflictError';
        report(owner.conflict ? 'Конфликт: проект изменён в другой вкладке' : 'Не удалось сохранить. Работа остаётся открытой');
      }
    });
  }
  function syncControls() {
    for (const [key, value] of [['algo', state.algorithm], ['format', state.activeFormat],
      ['kernel', state.kernelSize], ['code', state.activeCodeTab], ['occasion', state.occasion]]) setToggleGroup(key, value);
    for (const [id, value] of Object.entries({ colorCountSlider: state.colorCount, deltaSlider: state.minDelta,
      sortSelect: state.sortBy, weatherTempSlider: state.weatherTemp, bloggerPromoInput: state.bloggerPromo })) $(id).value = value;
    $('colorCountValue').textContent = state.colorCount;
    $('deltaValue').textContent = state.minDelta;
    $('weatherTempLabel').textContent = `${state.weatherTemp > 0 ? '+' : ''}${state.weatherTemp}°C`;
    $('togglePinsCheckbox').checked = state.showPins;
  }
  async function restore(record, expectedInteraction, activate = false) {
    const prepared = await prepareProject(record);
    if (interaction !== expectedInteraction) return false;
    if (activate) {
      await storage.activate(prepared.project.id, prepared.project.revision);
      if (interaction !== expectedInteraction) return false;
    }
    restoring = true;
    try {
      photo.restoreProject(prepared);
      syncControls();
      current = { identity: prepared.project, image: Promise.resolve(record.image),
        preview: createProjectPreview(prepared.canvas).catch(() => undefined),
        revision: prepared.project.revision, signature: '' };
      const snapshot = captureProject(state, story, canvas, current.identity);
      current.signature = JSON.stringify({ ...snapshot, updatedAt: 0, revision: 0 });
      report('Сохранено на устройстве');
      return true;
    } finally { restoring = false; }
  }
  retry.addEventListener('click', () => {
    for (const task of failed.values()) { task.owner.conflict = false; enqueue(task); }
    flush();
  });
  copy.addEventListener('click', () => {
    flush(); // Include edits made after the conflict was first reported.
    for (const task of [...failed.values()]) {
      if (!task.owner.conflict) continue;
      failed.delete(task.owner.identity.id);
      const nextIdentity = { ...identity(), name: task.snapshot.name, savedToLibrary: task.snapshot.savedToLibrary === true };
      const owner = { identity: nextIdentity, image: task.image, preview: task.owner.preview,
        revision: null, signature: '', changeVersion: 0 };
      if (task.owner === current) current = owner;
      const snapshot = { ...task.snapshot, ...nextIdentity, updatedAt: nextIdentity.createdAt };
      enqueue({ owner, snapshot, image: task.image,
        signature: JSON.stringify({ ...snapshot, updatedAt: 0, revision: 0 }), changeVersion: 0 });
    }
  });
  reload.addEventListener('click', async () => {
    const token = interaction;
    try {
      const id = current.identity.id;
      if (await restore(await storage.get(id), token)) { failed.delete(id); report('Сохранено на устройстве'); }
    } catch { report('Не удалось открыть сохранённую версию'); }
  });
  // Observe committed UI operations, including keyboard crop; snapshot comparison avoids no-op writes.
  for (const event of ['input', 'change', 'click', 'pointerup', 'pointercancel', 'keydown']) {
    document.addEventListener(event, e => {
      if (e.target.closest?.('#projectPersistence, .project-library, [data-project-launch]')) return;
      interaction++;
      changed();
    });
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('beforeunload', event => {
    if (failed.size || status.textContent !== 'Сохранено на устройстве') { event.preventDefault(); event.returnValue = ''; }
  });
  async function settleCurrent() {
    if (!current) throw new Error('Дождитесь загрузки фотографии');
    if (state.draggingPinId || storyStudio.editing) throw new Error('Сначала завершите перетаскивание');
    palette.settlePending();
    const owner = current;
    await flush();
    if (owner !== current) throw new Error('Фотография изменилась. Повторите действие');
    if (failed.size || owner.revision === null) throw new Error('Сначала сохраните текущие изменения или разрешите конфликт');
    return owner;
  }
  function adopt(saved, owner) {
    if (owner !== current) return;
    owner.identity = saved;
    owner.revision = saved.revision;
    owner.signature = JSON.stringify({ ...captureProject(state, story, canvas, saved), updatedAt: 0, revision: 0 });
    report('Сохранено на устройстве');
  }
  const api = {
    newPhoto, changed, flush,
    preparePhotoChange(isCurrent) {
      if (!current) return true;
      const owner = current;
      const signature = () => JSON.stringify({ ...captureProject(state, story, canvas, owner.identity), updatedAt: 0, revision: 0 });
      if (!failed.has(owner.identity.id) && owner.signature === signature()) return true;
      return (async () => {
        while (isCurrent() && owner === current) {
          await flush();
          if (!isCurrent() || owner !== current) return false;
          if (failed.has(owner.identity.id)) {
            const discard = window.confirm('Не удалось сохранить текущую работу. Нажмите «Отмена», чтобы повторить сохранение или скачать проект. Продолжить без сохранения последних изменений?');
            if (!discard) return false;
            owner.deleted = true;
            failed.delete(owner.identity.id);
            return true;
          }
          if (owner.signature === signature()) return true;
        }
        return false;
      })();
    },
    currentName: () => current?.identity.name || 'Моя палитра',
    async exportCurrent() {
      if (!current) throw new Error('Дождитесь загрузки фотографии');
      if (state.draggingPinId || storyStudio.editing) throw new Error('Сначала завершите перетаскивание');
      palette.settlePending();
      const project = captureProject(state, story, canvas, current.identity);
      // Backup remains available even when IndexedDB is full or access is denied.
      return exportProjectFile({ project, image: await encodePhoto(canvas) });
    },
    async exportProject(id, revision) {
      await flush();
      const record = await storage.get(id);
      if (!record || record.project.revision !== revision) throw new Error('Проект изменился. Обновите библиотеку');
      return exportProjectFile(record);
    },
    async importProject(file) {
      const record = await readProjectFile(file);
      let prepared;
      try { prepared = await prepareProject(record); }
      catch { throw new Error('Не удалось прочитать изображение проекта. Файл может быть повреждён.'); }
      const project = { ...record.project, ...identity(), name: record.project.name, savedToLibrary: true };
      project.updatedAt = project.createdAt;
      const saved = await storage.save(project, record.image, null,
        { makeCurrent: false, previewBytes: await createProjectPreview(prepared.canvas) });
      return saved.id;
    },
    async listProjects() { await flush(); return (await storage.list()).filter(p => p.savedToLibrary); },
    async saveCurrent(name) {
      const owner = await settleCurrent();
      const snapshot = captureProject(state, story, canvas, { ...owner.identity, name, savedToLibrary: true });
      const saved = await storage.save(snapshot, undefined, owner.revision, { previewBytes: await owner.preview });
      adopt(saved, owner);
      return saved.id;
    },
    async openProject(id, revision) {
      await settleCurrent();
      const token = ++interaction;
      const record = await storage.get(id);
      if (!record || record.project.revision !== revision) throw new Error('Проект изменился. Обновите библиотеку');
      if (!await restore(record, token, true)) throw new Error('Открытие отменено: работа изменилась');
    },
    async renameProject(id, revision, name) {
      const owner = await settleCurrent();
      const record = await storage.get(id);
      if (!record) throw new Error('Проект уже удалён');
      if (id === owner.identity.id && record.project.revision !== owner.revision) {
        throw new Error('Текущая работа изменена в другой вкладке. Обновите библиотеку и откройте сохранённую версию перед переименованием.');
      }
      const saved = await storage.save({ ...record.project, name, updatedAt: Date.now(), savedToLibrary: true },
        undefined, revision, { makeCurrent: id === owner.identity.id });
      if (id === owner.identity.id) adopt(saved, owner);
      return id;
    },
    async duplicateProject(id, revision, name) {
      await settleCurrent();
      const record = await storage.get(id);
      if (!record || record.project.revision !== revision) throw new Error('Проект изменился. Обновите библиотеку');
      const prepared = await prepareProject(record);
      const next = { ...record.project, ...identity(), name, savedToLibrary: true };
      next.updatedAt = next.createdAt;
      const saved = await storage.save(next, record.image, null,
        { makeCurrent: false, previewBytes: await createProjectPreview(prepared.canvas) });
      return saved.id;
    },
    async removeProject(id, revision) {
      const owner = await settleCurrent();
      if (owner.identity.id === id) owner.deleted = true;
      try { await storage.remove(id, revision); }
      catch (error) { owner.deleted = false; throw error; }
      failed.delete(id);
      if (current === owner && owner.identity.id === id) {
        clearTimeout(timer);
        current = null;
        window.loadPresetSample('interior');
      }
    },
    async start() {
      const token = interaction;
      try {
        const id = await storage.lastProjectId();
        const record = id ? await storage.get(id) : null;
        if (record && await restore(record, token)) return;
      } catch { report('Восстановление недоступно. Можно продолжить работу'); }
      finally { started = true; }
      if (!state.palette.length && photo.loading) return;
      if (!state.palette.length) window.loadPresetSample('interior');
      else newPhoto();
    }
  };
  createProjectLibrary(api);
  return api;
}
