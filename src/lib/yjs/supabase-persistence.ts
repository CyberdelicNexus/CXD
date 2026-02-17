/**
 * Supabase Y.Doc Persistence
 *
 * Saves and loads Y.Doc binary state to/from a Supabase `yjs_state` column.
 * Replaces the old full project_data JSON approach with compact binary diffs.
 *
 * Strategy:
 * - On load: fetch yjs_state from DB → apply to Y.Doc
 * - On save: encode Y.Doc state → upsert to yjs_state column
 * - Debounced saves (2s) to avoid excessive DB writes
 */

import * as Y from 'yjs';
import { createClient } from '@/supabase/client';

const SAVE_DEBOUNCE_MS = 2000;

export class SupabasePersistence {
  private doc: Y.Doc;
  private projectId: string;
  private destroyed = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private updateHandler: (update: Uint8Array, origin: unknown) => void;
  private isSaving = false;

  constructor(doc: Y.Doc, projectId: string) {
    this.doc = doc;
    this.projectId = projectId;

    // Schedule save on every local change
    this.updateHandler = (_update: Uint8Array, origin: unknown) => {
      if (this.destroyed) return;
      // Save on both local and remote changes (remote = peer updates we receive)
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
   * Save Y.Doc state to Supabase immediately.
   */
  async save(): Promise<void> {
    if (this.destroyed || this.isSaving) return;

    this.isSaving = true;
    try {
      const state = Y.encodeStateAsUpdate(this.doc);
      // Convert Uint8Array to base64 without spread (avoids downlevelIteration issue)
      let binary = '';
      for (let i = 0; i < state.length; i++) {
        binary += String.fromCharCode(state[i]);
      }
      const base64 = btoa(binary);

      const supabase = createClient();
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
   * Schedule a debounced save.
   */
  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.save();
    }, SAVE_DEBOUNCE_MS);
  }

  /**
   * Clean up listeners and flush pending saves.
   */
  destroy(): void {
    this.destroyed = true;
    this.doc.off('update', this.updateHandler);

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    // Final save before destroy
    this.save();
  }
}
