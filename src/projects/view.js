import { $ } from '../dom.js';
import { downloadBlob } from '../story/export.js';

/** Native dialogs provide focus containment, inert background and Escape handling. */
export function createProjectLibrary(api) {
  const dialog = $('projectLibrary'), editor = $('projectEditor');
  const grid = $('projectLibraryGrid'), message = $('projectLibraryMessage');
  const error = $('projectLibraryError'), editorError = $('projectEditorError');
  const name = $('projectNameInput'), confirm = $('projectEditorConfirm');
  let urls = [], loadVersion = 0, busy = false, edit, opener, editOpener;
  const formatDate = new Intl.DateTimeFormat('ru', { dateStyle: 'medium', timeStyle: 'short' });
  function revoke() { urls.forEach(url => URL.revokeObjectURL(url)); urls = []; }
  function showError(target, failure) {
    target.textContent = failure.name === 'QuotaExceededError'
      ? 'Недостаточно места в браузере. Освободите место и повторите действие.'
      : failure.name === 'ProjectConflictError'
      ? 'Проект изменён в другой вкладке. Обновите библиотеку и повторите действие.'
      : failure.message || 'Не удалось выполнить действие. Попробуйте ещё раз.';
    target.hidden = false;
  }
  function button(text, action, project) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn small'; b.textContent = text;
    b.dataset.projectId = project.id; b.dataset.projectAction = action;
    b.setAttribute('aria-label', `${text}: ${project.name}`);
    b.addEventListener('click', () => {
      if (busy) return;
      if (action === 'open') openProject(project);
      else if (action === 'export') exportSaved(project);
      else openEditor(action, project, b);
    });
    return b;
  }
  async function refresh(focusId, focusAction = 'open') {
    const version = ++loadVersion;
    error.hidden = true;
    message.textContent = 'Открываем сохранённые палитры…';
    try {
      const projects = await api.listProjects();
      if (!dialog.open || version !== loadVersion) return;
      revoke(); grid.replaceChildren();
      message.textContent = projects.length ? `Сохранено: ${projects.length}`
        : 'Здесь пока нет палитр. Сохраните текущую работу с названием, чтобы вернуться к ней позже.';
      for (const project of projects) {
        const card = document.createElement('article'); card.className = 'project-card';
        const open = button('Открыть', 'open', project); open.className = 'project-preview';
        open.replaceChildren();
        if (project.preview?.byteLength) {
          const url = URL.createObjectURL(new Blob([project.preview], { type: 'image/png' })); urls.push(url);
          const img = document.createElement('img'); img.src = url; img.alt = ''; img.loading = 'lazy';
          open.append(img);
        }
        const title = document.createElement('span'); title.className = 'project-title'; title.textContent = project.name;
        open.append(title);
        const swatches = document.createElement('div'); swatches.className = 'project-swatches'; swatches.setAttribute('aria-hidden', 'true');
        for (const c of project.colors) {
          const swatch = document.createElement('span'); swatch.style.backgroundColor = `rgb(${c.r} ${c.g} ${c.b})`; swatches.append(swatch);
        }
        const date = document.createElement('time'); date.dateTime = new Date(project.updatedAt).toISOString();
        date.textContent = formatDate.format(project.updatedAt);
        const actions = document.createElement('div'); actions.className = 'project-actions';
        actions.append(button('Переименовать', 'rename', project), button('Создать копию', 'duplicate', project),
          button('Скачать проект', 'export', project), button('Удалить', 'remove', project));
        card.append(open, swatches, date, actions); grid.append(card);
      }
      if (focusId) {
        const target = [...grid.querySelectorAll('button')].find(b => b.dataset.projectId === focusId && b.dataset.projectAction === focusAction);
        (target || grid.querySelector('button') || $('librarySaveCurrent')).focus();
      }
    } catch (failure) {
      if (dialog.open && version === loadVersion) { message.textContent = ''; showError(error, failure); }
    }
  }
  function openLibrary(event) {
    if (dialog.open) return;
    opener = event?.currentTarget || $('openProjectLibrary');
    dialog.showModal();
    refresh();
  }
  function openEditor(action, project, source) {
    if (busy || editor.open) return;
    edit = { action, project }; editOpener = source || document.activeElement;
    editorError.hidden = true;
    const removing = action === 'remove';
    $('projectEditorTitle').textContent = { save: 'Сохранить палитру', rename: 'Переименовать палитру', duplicate: 'Создать копию', remove: 'Удалить палитру?' }[action];
    $('projectEditorDescription').textContent = removing
      ? `«${project.name}» будет удалена из этого браузера. Это действие нельзя отменить.`
      : 'Название поможет найти работу в библиотеке.';
    $('projectNameLabel').hidden = removing;
    name.required = !removing;
    name.value = action === 'duplicate' ? `${project.name.slice(0, 112)} — копия` : project?.name || api.currentName();
    confirm.textContent = removing ? 'Удалить' : 'Сохранить';
    editor.showModal();
    if (removing) $('projectEditorCancel').focus(); else { name.focus(); name.select(); }
  }
  async function openProject(project) {
    busy = true; dialog.setAttribute('aria-busy', 'true'); error.hidden = true;
    try { await api.openProject(project.id, project.revision); dialog.close(); }
    catch (failure) { showError(error, failure); }
    finally { busy = false; dialog.removeAttribute('aria-busy'); }
  }
  async function exportSaved(project) {
    busy = true; error.hidden = true;
    message.textContent = 'Готовим файл проекта…';
    try {
      const file = await api.exportProject(project.id, project.revision);
      downloadBlob(file.blob, file.filename);
      message.textContent = 'Файл проекта подготовлен для скачивания.';
    } catch (failure) { showError(error, failure); }
    finally { busy = false; }
  }
  $('downloadCurrentProject').addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    const status = $('projectTransferStatus');
    status.textContent = 'Готовим файл проекта…';
    try {
      const file = await api.exportCurrent();
      downloadBlob(file.blob, file.filename);
      status.textContent = 'Файл проекта подготовлен для скачивания.';
    } catch (failure) { status.textContent = failure.message; }
    finally { busy = false; }
  });
  $('importProjectButton').addEventListener('click', () => { if (!busy) $('projectFileInput').click(); });
  $('projectFileInput').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy) return;
    busy = true; error.hidden = true; message.textContent = 'Проверяем файл проекта…';
    try {
      const id = await api.importProject(file);
      await refresh(id);
      if (dialog.open) message.textContent = 'Проект добавлен в библиотеку. Откройте его, чтобы продолжить работу.';
    } catch (failure) {
      message.textContent = '';
      showError(error, failure);
    } finally { busy = false; }
  });
  $('projectEditorForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const value = name.value.trim();
    if (edit.action !== 'remove' && !value) { showError(editorError, new Error('Введите название палитры')); name.focus(); return; }
    busy = true; confirm.disabled = true; editorError.hidden = true;
    const { action, project } = edit;
    try {
      let id;
      if (action === 'save') id = await api.saveCurrent(value);
      if (action === 'rename') id = await api.renameProject(project.id, project.revision, value);
      if (action === 'duplicate') id = await api.duplicateProject(project.id, project.revision, value);
      if (action === 'remove') await api.removeProject(project.id, project.revision);
      editor.close();
      if (!dialog.open && action === 'save') openLibrary({ currentTarget: editOpener });
      else if (dialog.open) await refresh(id || project.id, action === 'rename' ? 'rename' : 'open');
    } catch (failure) { showError(editorError, failure); }
    finally { busy = false; confirm.disabled = false; }
  });
  $('openProjectLibrary').addEventListener('click', openLibrary);
  $('saveProjectToLibrary').addEventListener('click', event => openEditor('save', null, event.currentTarget));
  $('librarySaveCurrent').addEventListener('click', event => openEditor('save', null, event.currentTarget));
  $('refreshProjectLibrary').addEventListener('click', () => { if (!busy) refresh(); });
  $('closeProjectLibrary').addEventListener('click', () => dialog.close());
  $('projectEditorCancel').addEventListener('click', () => { if (!busy) editor.close(); });
  editor.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  editor.addEventListener('close', () => { if (editOpener?.isConnected) editOpener.focus(); });
  dialog.addEventListener('close', () => {
    loadVersion++; revoke(); grid.replaceChildren();
    if (opener?.isConnected) opener.focus();
  });
}
