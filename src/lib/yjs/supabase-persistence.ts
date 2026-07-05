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
import { createSnapshot } from './snapshot-service';
import { yDocToProject } from './y-doc-factory';
import type { CXDProject } from '@/types/cxd-schema';

const SAVE_DEBOUNCE_MS = 2000;
const MAX_RETRIES = 3;
// Each recorded failure already represents MAX_RETRIES exhausted attempts
// (or a non-retryable permission error), so surface trouble early.
const CONSECUTIVE_FAILURES_THRESHOLD = 2;

export type PersistenceSaveStatus = 'saving' | 'saved' | 'error';

export interface SupabasePersistenceOpts {
  onError?: (error: string) => void;
  /** Fires on every save lifecycle transition — wire this to the UI save indicator. */
  onStatusChange?: (status: PersistenceSaveStatus, message?: string) => void;
  /**
   * Returns the current Zustand project snapshot. When provided, each save
   * also derives project_data JSON from the SAME Y.Doc snapshot as the binary
   * (merged over this base for fields that don't live in the Y.Doc) and writes
   * both columns in one atomic UPDATE — the two representations can no longer
   * desync.
   */
  getBaseProject?: () => CXDProject | null;
}

export class SupabasePersistence {
  private doc: Y.Doc;
  private projectId: string;
  private destroyed = false;
  /**
   * Saves are gated until the provider finishes hydration (IndexedDB +
   * Supabase load + seeding) and calls markReady(). Without this gate, doc
   * updates fired DURING loading (e.g., partial IndexedDB state) schedule
   * saves that can persist incomplete data over the DB's complete state.
   */
  private ready = false;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private updateHandler: (update: Uint8Array, origin: unknown) => void;
  /** Tracks the currently running save promise so destroy() can await it. */
  private activeSavePromise: Promise<boolean> | null = null;
  private consecutiveFailures = 0;
  private onPersistenceError?: (error: string) => void;
  private onStatusChange?: (status: PersistenceSaveStatus, message?: string) => void;
  private getBaseProject?: () => CXDProject | null;
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
    this.onStatusChange = opts?.onStatusChange;
    this.getBaseProject = opts?.getBaseProject;

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

      // Safety net: snapshot the existing DB state before we load it
      createSnapshot(this.projectId, 'Pre-load backup').catch(() => {});

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
  /**
   * Enable saving. Call once hydration is complete and the Y.Doc holds the
   * full known state. Also kicks a first save so state assembled during
   * loading (e.g., JSON-initialized docs) reaches the DB.
   */
  markReady(): void {
    if (this.ready || this.destroyed) return;
    this.ready = true;
    this.scheduleSave();
  }

  async save(retryAttempt = 0): Promise<boolean> {
    if (this.destroyed) return false;
    if (!this.ready) return true; // nothing to persist yet — loading in progress
    // If a save is already running, don't stack another — join its result.
    if (this.activeSavePromise) return this.activeSavePromise;

    this.activeSavePromise = this._executeSave(retryAttempt).finally(() => {
      this.activeSavePromise = null;
    });
    return this.activeSavePromise;
  }

  private async _executeSave(retryAttempt = 0): Promise<boolean> {
    try {
      if (retryAttempt === 0) this.onStatusChange?.('saving');
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

      const savedAt = new Date().toISOString();

      // Derive project_data from the SAME Y.Doc snapshot as the binary so the
      // two columns are written consistently in one atomic UPDATE.
      const base = this.getBaseProject?.() ?? null;
      let projectData: CXDProject | null = null;
      if (base && !(base as unknown as { _listingOnly?: boolean })._listingOnly) {
        const fromDoc = yDocToProject(this.doc);

        // Wipe guard: if the Y.Doc looks empty while Zustand has content, we're
        // most likely mid-load — skip the whole save rather than persist a wipe.
        const baseElementCount = base.canvasLayout?.elements?.length ?? 0;
        const docElementCount = fromDoc.canvasLayout?.elements?.length ?? 0;
        if (baseElementCount > 0 && docElementCount === 0) {
          console.warn(
            '[SupabasePersistence] Skipping save — Y.Doc has no elements while store has',
            baseElementCount,
            '(likely mid-load). Will retry on next change.'
          );
          return false;
        }

        projectData = mergeProjectWithDoc(base, fromDoc, savedAt);
      }

      const { error } = await supabase
        .from('cxd_projects')
        .update({
          yjs_state: base64,
          updated_at: savedAt,
          ...(projectData
            ? {
                project_data: projectData,
                name: projectData.name,
                description: projectData.description,
                share_token: projectData.shareToken || null,
              }
            : {}),
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
          this.scheduleRetry(retryAttempt);
        }
        return false;
      }

      // Success — reset failure counter and update cache for next save
      this.consecutiveFailures = 0;
      this.lastLoadedState = merged;
      this.onStatusChange?.('saved');
      return true;
    } catch (err) {
      const isNetworkError = err instanceof TypeError && err.message.includes('fetch');

      if (isNetworkError) {
        console.warn(`[SupabasePersistence] Network error on save (attempt ${retryAttempt + 1}):`, err);
        this.scheduleRetry(retryAttempt);
        return false;
      }

      console.error('[SupabasePersistence] Save error:', err);
      this.recordFailure(String(err));
      return false;
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
    // A recorded failure means retries are exhausted (or the error is
    // non-retryable) — the user should see it immediately.
    this.onStatusChange?.('error', message);
    if (this.consecutiveFailures >= CONSECUTIVE_FAILURES_THRESHOLD) {
      const errMsg = `[SupabasePersistence] ${this.consecutiveFailures} consecutive save failures. Last error: ${message}`;
      console.error(errMsg);
      this.onPersistenceError?.(errMsg);
    }
  }

  /**
   * Cancel any pending debounce and save immediately.
   * Call this on visibilitychange (tab hidden) and beforeunload.
   * Resolves true when the save reached the database.
   */
  flush(): Promise<boolean> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    return this.save();
  }

  /**
   * Schedule a debounced save.
   */
  private scheduleSave(): void {
    if (!this.ready) return;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.save();
    }, SAVE_DEBOUNCE_MS);
  }

  /**
   * Clean up listeners and flush pending saves.
   *
   * Guarantees ALL changes are written:
   * 1. Cancel the pending debounce (prevents a double-save race).
   * 2. If a save is already in-flight, wait for it to finish — it may not
   *    have captured the very latest state (it encoded at the moment it started).
   * 3. Do one final save to capture any changes made since the last save began.
   * 4. Only then mark as destroyed.
   */
  async destroy(): Promise<void> {
    // Cancel pending debounce
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    // Detach update listener before the final save to avoid re-scheduling
    this.doc.off('update', this.updateHandler);

    // Wait for any in-flight save to finish so we know exactly what was committed
    if (this.activeSavePromise) {
      await this.activeSavePromise;
    }

    // Final save — but only if hydration completed. Destroying mid-load
    // (rapid project switch) must NOT write a partially-loaded doc to the DB.
    if (this.ready) {
      await this._executeSave(0);
    }

    // Only now mark as destroyed
    this.destroyed = true;
  }
}

// ─── project_data Derivation ─────────────────────────────────────────────────

/**
 * Fields where an empty/falsy Y.Doc value must never clobber the base —
 * they're identity fields seeded into meta; a legacy doc missing them
 * would otherwise blank the project row.
 */
const PROTECTED_META_FIELDS = new Set(['id', 'name', 'ownerId', 'createdAt', 'schemaVersion']);

/**
 * Merge the Y.Doc projection over the Zustand base project.
 *
 * The Y.Doc is authoritative for everything it stores (canvas, design fields,
 * comments, versions, OKRs, meta). Fields that live only in Zustand
 * (tourCompleted, share images, canvasLayout.boards, sectionPositions when
 * absent from meta) ride along from the base — so new CXDProject fields keep
 * persisting without touching this code.
 */
function mergeProjectWithDoc(base: CXDProject, fromDoc: CXDProject, savedAt: string): CXDProject {
  const merged: Record<string, unknown> = { ...(base as unknown as Record<string, unknown>) };

  for (const [key, value] of Object.entries(fromDoc as unknown as Record<string, unknown>)) {
    if (key === 'canvasLayout') continue; // merged separately below
    if (value === undefined) continue;
    if (PROTECTED_META_FIELDS.has(key) && !value) continue;
    merged[key] = value;
  }

  const canvasLayout: Record<string, unknown> = {
    ...((base.canvasLayout ?? {}) as unknown as Record<string, unknown>),
  };
  for (const [key, value] of Object.entries((fromDoc.canvasLayout ?? {}) as unknown as Record<string, unknown>)) {
    if (value === undefined) continue;
    canvasLayout[key] = value;
  }
  merged.canvasLayout = canvasLayout;
  merged.updatedAt = savedAt;

  return merged as unknown as CXDProject;
}
