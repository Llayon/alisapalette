import { validateProject, validateImage, projectSummary } from './schema.js';

export class ProjectConflictError extends Error {
  constructor() { super('Project changed in another tab'); this.name = 'ProjectConflictError'; }
}

/** Each factory owns its connection; version changes release it for other tabs. */
export function createProjectStorage({ name = 'chromastyle.projects.v1', indexedDB } = {}) {
  let connection;
  let opening;
  function open() {
    if (connection) return Promise.resolve(connection);
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      // Some privacy settings deny even access to the indexedDB property.
      const factory = indexedDB === undefined ? globalThis.indexedDB : indexedDB;
      if (!factory) { reject(new Error('Local storage unavailable')); return; }
      const request = factory.open(name, 1);
      request.onupgradeneeded = () => {
        for (const store of ['projects', 'contents', 'session']) request.result.createObjectStore(store);
      };
      request.onerror = () => reject(request.error);
      let blocked = false;
      request.onblocked = () => { blocked = true; reject(new Error('Close other tabs to update local storage')); };
      request.onsuccess = () => {
        // A blocked open request cannot be cancelled; release its eventual connection.
        if (blocked) { request.result.close(); return; }
        connection = request.result;
        connection.onversionchange = close;
        resolve(connection);
      };
    }).finally(() => { opening = null; });
    return opening;
  }
  function close() { connection?.close(); connection = null; }
  async function transaction(stores, mode, run) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let value, failure;
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(failure || tx.error || new Error('Project transaction aborted'));
      tx.onerror = event => {
        failure ||= event.target.error;
        try { tx.abort(); } catch { /* Already aborted; onabort reports rollback. */ }
      };
      try {
        run(tx, result => { value = result; }, error => { failure = error; tx.abort(); });
      } catch (error) { failure = error; tx.abort(); }
    });
  }
  return {
    close,
    async save(input, image, expectedRevision = null, { makeCurrent = true, previewBytes } = {}) {
      const project = validateProject(input);
      if (previewBytes !== undefined && (!(previewBytes instanceof ArrayBuffer) || previewBytes.byteLength > 512 * 1024)) {
        throw new Error('Invalid project preview');
      }
      // WebKit on Windows cannot reliably persist canvas-produced Blob objects.
      // Convert before opening the transaction; keep its requests synchronous.
      const imageBytes = image !== undefined ? await validateImage(image).arrayBuffer() : undefined;
      return transaction(['projects', 'contents', 'session'], 'readwrite', (tx, done, fail) => {
        const projects = tx.objectStore('projects'), contents = tx.objectStore('contents');
        const request = projects.get(project.id);
        request.onsuccess = () => {
          try {
            const previous = request.result;
            if ((previous?.revision ?? null) !== expectedRevision) { fail(new ProjectConflictError()); return; }
            const contentRequest = contents.get(project.id);
            contentRequest.onsuccess = () => {
              try {
                const photo = imageBytes ?? contentRequest.result?.imageBytes ?? contentRequest.result?.image;
                if (!photo) { fail(new Error('Project image required')); return; }
                const saved = { ...project, revision: (previous?.revision ?? 0) + 1 };
                projects.put({ ...projectSummary(saved), preview: previewBytes ?? previous?.preview }, saved.id);
                contents.put({ project: saved, imageBytes: photo }, saved.id);
                if (makeCurrent) tx.objectStore('session').put(saved.id, 'lastProjectId');
                done(saved);
              } catch (error) { fail(error); }
            };
          } catch (error) { fail(error); }
        };
      });
    },
    get(id) {
      return transaction(['contents'], 'readonly', (tx, done) => {
        const request = tx.objectStore('contents').get(id);
        request.onsuccess = () => {
          const record = request.result;
          done(record ? { project: record.project,
            image: new Blob([record.imageBytes ?? record.image], { type: 'image/png' }) } : null);
        };
      });
    },
    list() {
      return transaction(['projects'], 'readonly', (tx, done) => {
        const request = tx.objectStore('projects').getAll();
        request.onsuccess = () => done(request.result.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id)));
      });
    },
    lastProjectId() {
      return transaction(['session'], 'readonly', (tx, done) => {
        const request = tx.objectStore('session').get('lastProjectId');
        request.onsuccess = () => done(request.result ?? null);
      });
    },
    activate(id, expectedRevision) {
      return transaction(['projects', 'session'], 'readwrite', (tx, done, fail) => {
        const request = tx.objectStore('projects').get(id);
        request.onsuccess = () => {
          if (!request.result || request.result.revision !== expectedRevision) { fail(new ProjectConflictError()); return; }
          tx.objectStore('session').put(id, 'lastProjectId');
          done();
        };
      });
    },
    remove(id, expectedRevision) {
      return transaction(['projects', 'contents', 'session'], 'readwrite', (tx, done, fail) => {
        const projects = tx.objectStore('projects');
        const request = projects.get(id);
        request.onsuccess = () => {
          if ((request.result?.revision ?? null) !== expectedRevision) { fail(new ProjectConflictError()); return; }
          projects.delete(id);
          tx.objectStore('contents').delete(id);
          const session = tx.objectStore('session'), last = session.get('lastProjectId');
          last.onsuccess = () => { if (last.result === id) session.delete('lastProjectId'); };
          done();
        };
      });
    }
  };
}
