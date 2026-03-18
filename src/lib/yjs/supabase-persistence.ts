/**
 * Supabase Y.Doc Persistence
 *
 * Saves and loads Y.Doc binary state to/from a Supabase `yjs_state` column.
 * Replaces the old full project_data JSON approach with compact binary diffs.
 *
 * Strategy:
 * - On load: fetch yjs_state from DB → apply to Y.Doc
 * - On save: read-merge-write (CRDT merge) to never overwrite concurrent changes
 * - Debounced saves (2s) to avoid excessive DB writes
 */

import * as Y from 'yjs';
import { createClient } from '@/supabase/client';

const SAVE_DEBOUNCE_MS = 2000;

export class SupabasePersistence {
  private doc: Y.Doc;
  private projectId: string;
  private destroyed = false;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private updateHandler: (update: Uint8Array, origin: unknown) => void;
  private isSaving = false;

  constructor(doc: Y.Doc, projectId: string) {
    this.doc = doc;
    this.projectId = projectId;

    // Schedule save on every local or remote change
    this.updateHandler = (_update: Uint8Array, _origin: unknown) => {
      if (this.destroyed) return;
      this.scheduleSave();
    };

    this.doc.on('update', this.updateHandler);
  }

  /**
   * Load persisted Y.Doc state from Supabase.
   * Returns true if state was found and applied, false if no persisted state exists.
   */
  async load(): Promise<boolean> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('cxd_projects')
        .select('yjs_state')
        .eq('id', this.projectId)
        .single();

      if (error || !data?.yjs_state) {
        return false;
      }

      // yjs_state is stored as a base64-encoded binary
      const binary = Uint8Array.from(atob(data.yjs_state), (c) => c.charCodeAt(0));
      Y.applyUpdate(this.doc, binary, 'persistence');
      return true;
    } catch (err) {
      console.error('[SupabasePersistence] Failed to load Y.Doc state:', err);
      return false;
    }
  }

  /**
   * Save Y.Doc state to Supabase using read-merge-write so that concurrent
   * changes from other clients (collaborators or owner on another tab) are
   * never silently overwritten.
   *
   * Steps:
   *   1. Read current yjs_state from DB
   *   2. Apply it to a temporary mergeDoc
   *   3. Apply local doc state to mergeDoc (CRDT merge — never loses data)
   *   4. Encode merged result and write back
   */
  async save(): Promise<void> {
    if (this.destroyed || this.isSaving) return;

    this.isSaving = true;
    try {
      const supabase = createClient();

      // Step 1: fetch current persisted state
      const { data } = await supabase
        .from('cxd_projects')
        .select('yjs_state')
        .eq('id', this.projectId)
        .single();

      // Step 2 & 3: merge persisted state with local state
      const mergeDoc = new Y.Doc();
      if (data?.yjs_state) {
        const persisted = Uint8Array.from(atob(data.yjs_state), (c) => c.charCodeAt(0));
        Y.applyUpdate(mergeDoc, persisted);
      }
      const localState = Y.encodeStateAsUpdate(this.doc);
      Y.applyUpdate(mergeDoc, localState);

      // Step 4: encode merged result
      const merged = Y.encodeStateAsUpdate(mergeDoc);
      mergeDoc.destroy();

      // Convert Uint8Array to base64 without spread (avoids downlevelIteration issue)
      let binary = '';
      for (let i = 0; i < merged.length; i++) {
        binary += String.fromCharCode(merged[i]);
      }
      const base64 = btoa(binary);

      const { error } = await supabase
        .from('cxd_projects')
        .update({
          yjs_state: base64,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.projectId);

      if (error) {
        console.error('[SupabasePersistence] Failed to save Y.Doc state:', error);
      }
    } catch (err) {
      console.error('[SupabasePersistence] Save error:', err);
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Cancel any pending debounce and save immediately.
   * Call this on visibilitychange (tab hidden) and beforeunload.
   */
  flush(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.save();
  }

  /**
   * Schedule a debounced save.
   */
  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.save();
    }, SAVE_DEBOUNCE_MS);
  }

  /**
   * Clean up listeners and flush pending saves.
   * Awaits the final save BEFORE marking destroyed so save() is not skipped.
   */
  async destroy(): Promise<void> {
    // Cancel pending debounce
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    // Detach update listener before the final save to avoid re-scheduling
    this.doc.off('update', this.updateHandler);

    // Perform the final save while destroyed is still false
    await this.save();

    // Only now mark as destroyed
    this.destroyed = true;
  }
}
