/**
 * IndexedDB Y.Doc Persistence
 *
 * Wraps y-indexeddb for client-side offline persistence.
 * When the user is offline, changes are stored locally in IndexedDB.
 * When they reconnect, the Y.Doc sync protocol merges local + remote state.
 *
 * Database name pattern: `cxd-yjs-{projectId}`
 */

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

const DB_PREFIX = 'cxd-yjs-';

export class LocalPersistence {
  private provider: IndexeddbPersistence;
  private _synced = false;

  constructor(doc: Y.Doc, projectId: string) {
    const dbName = `${DB_PREFIX}${projectId}`;
    this.provider = new IndexeddbPersistence(dbName, doc);

    this.provider.on('synced', () => {
      this._synced = true;
    });
  }

  /**
   * Whether the IndexedDB state has been loaded into the Y.Doc.
   */
  get isSynced(): boolean {
    return this._synced;
  }

  /**
   * Wait for IndexedDB persistence to finish loading.
   */
  async whenSynced(): Promise<void> {
    if (this._synced) return;
    return new Promise((resolve) => {
      this.provider.on('synced', () => resolve());
    });
  }

  /**
   * Clear the IndexedDB database for this project.
   * Useful when the project is deleted or for debugging.
   */
  async clearData(): Promise<void> {
    await this.provider.clearData();
  }

  /**
   * Clean up the IndexedDB persistence provider.
   */
  destroy(): void {
    this.provider.destroy();
  }
}

/**
 * Delete the IndexedDB database for a specific project.
 * Can be called without an active Y.Doc instance.
 */
export async function deleteProjectIndexedDb(projectId: string): Promise<void> {
  const dbName = `${DB_PREFIX}${projectId}`;
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
