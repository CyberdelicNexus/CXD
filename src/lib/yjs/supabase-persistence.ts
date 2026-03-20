/**
 * Supabase Y.Doc Persistence
 *
 * Saves and loads Y.Doc binary state to/from a Supabase `yjs_state` column.
 * Replaces the old full project_data JSON approach with compact binary diffs.
 *
 * Strategy:
 * - On load: fetch yjs_state from DB → apply to Y.Doc → cache as lastLoadedState
 * - On save: merge local Y.Doc with lastLoadedState (no extra SELECT per save)
 *   The local Y.Doc already contains all remote changes via real-time Yjs sync.
 *   Merging with lastLoadedState handles the edge case where a remote client
 *   saved to DB before our Yjs channel was established (e.g., initial load race).
 * - After each successful save: update lastLoadedState cache so next save merges
 *   from the latest known-good DB state.
 * - Debounced saves (2s) to avoid excessive DB writes
 * - Retry on network failure: up to 3 attempts with exponential backoff (1s, 2s, 4s)
 * - onError callback fires when consecutiveFailures >= 5
 */

import * as Y from 'yjs';
import { createClient } from '@/supabase/client';

const SAVE_DEBOUNCE_MS = 2000;
const MAX_RETRIES = 3;
const CONSECUTIVE_FAILURES_THRESHOLD = 5;

export interface SupabasePersistenceOpts {
  onError?: (error: string) => void;
}

export class SupabasePersistence {
  private doc: Y.Doc;
  private projectId: string;
  private destroyed = false;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private updateHandler: (update: Uint8Array, origin: unknown) => void;
  private isSaving = false;
  private consecutiveFailures = 0;
  private onPersistenceError?: (error: string) => void;
  /**
   * Cached state from the last load() or successful save().
   * Used as the merge base in save() to avoid a DB SELECT on every write.
   * null means no state has been loaded yet — first save just writes local state.
   */
  private lastLoadedState: Uint8Array | null = null;

  constructor(doc: Y.Doc, projectId: string, opts?: SupabasePersistenceOpts) {
    this.doc = doc;
    this.projectId = projectId;
    this.onPersistenceError = opts?.onError;

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
      // Cache the loaded state — save() uses this instead of re-fetching from DB
      this.lastLoadedState = binary;
      return true;
    } catch (err) {
      console.error('[SupabasePersistence] Failed to load Y.Doc state:', err);
      return false;
    }
  }

  /**
   * Save Y.Doc state to Supabase.
   *
   * Uses cached state from load() (or the previous successful save) as the merge
   * base — no SELECT per save. The local Y.Doc already contains all remote changes
   * via real-time Yjs sync. The cache merge handles the narrow edge case where a
   * remote client's changes reached DB before our Yjs channel was established.
   *
   * Steps:
   *   1. Merge local doc with lastLoadedState (cached — no DB round trip)
   *   2. Encode merged result and write back
   *   3. Update lastLoadedState cache on success
   */
  async save(retryAttempt = 0): Promise<void> {
    if (this.destroyed || this.isSaving) return;

    this.isSaving = true;
    try {
      const supabase = createClient();

      // Merge local state with cached last-loaded state (no SELECT needed)
      const mergeDoc = new Y.Doc();
      if (this.lastLoadedState) {
        Y.applyUpdate(mergeDoc, this.lastLoadedState);
      }
      const localState = Y.encodeStateAsUpdate(this.doc);
      Y.applyUpdate(mergeDoc, localState);

      // Encode merged result
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
        // Do NOT retry on RLS/permission errors — they won't resolve on their own
        const isPermissionError =
          (error as { code?: string }).code === '42501' ||
          error.message?.toLowerCase().includes('permission denied') ||
          error.message?.toLowerCase().includes('row-level security');

        if (isPermissionError) {
          console.error('[SupabasePersistence] Permission error saving Y.Doc state (no retry):', error);
          this.recordFailure(`Permission denied: ${error.message}`);
        } else {
          console.error('[SupabasePersistence] Failed to save Y.Doc state:', error);
          this.isSaving = false;
          this.scheduleRetry(retryAttempt);
          return;
        }
      } else {
        // Success — reset failure counter and update cache for next save
        this.consecutiveFailures = 0;
        this.lastLoadedState = merged;
      }
    } catch (err) {
      const isNetworkError = err instanceof TypeError && err.message.includes('fetch');

      if (isNetworkError) {
        console.warn(`[SupabasePersistence] Network error on save (attempt ${retryAttempt + 1}):`, err);
        this.isSaving = false;
        this.scheduleRetry(retryAttempt);
        return;
      }

      console.error('[SupabasePersistence] Save error:', err);
      this.recordFailure(String(err));
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Schedule a retry with exponential backoff.
   * Retries up to MAX_RETRIES times: 1s, 2s, 4s.
   * Does NOT retry on RLS/permission errors.
   */
  private scheduleRetry(attempt: number): void {
    if (attempt >= MAX_RETRIES) {
      this.recordFailure(`Save failed after ${MAX_RETRIES} retries`);
      return;
    }
    const delay = Math.pow(2, attempt) * 1000;
    console.warn(`[SupabasePersistence] Retrying save in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
    setTimeout(() => this.save(attempt + 1), delay);
  }

  /**
   * Record a persistence failure and fire onError if threshold exceeded.
   */
  private recordFailure(message: string): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= CONSECUTIVE_FAILURES_THRESHOLD) {
      const errMsg = `[SupabasePersistence] ${this.consecutiveFailures} consecutive save failures. Last error: ${message}`;
      console.error(errMsg);
      this.onPersistenceError?.(errMsg);
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
