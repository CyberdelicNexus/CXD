# Version History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-snapshot Y.Doc state at key moments and provide a UI to browse and restore snapshots.

**Architecture:** New `cxd_project_snapshots` Supabase table stores up to 20 base64-encoded Y.Doc snapshots per project. A `SnapshotService` handles CRUD + pruning. Auto-triggers fire on timer (30 min), tab close, project switch, and before Y.Doc load. A side panel accessed from the account menu lets users browse, manually checkpoint, and restore.

**Tech Stack:** Supabase (Postgres + RLS), Y.js (encodeStateAsUpdate/applyUpdate), React (side panel component), existing Zustand/bridge infrastructure for restore propagation.

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20240401000001_project_snapshots.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Project snapshots for version history
CREATE TABLE IF NOT EXISTS cxd_project_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES cxd_projects(id) ON DELETE CASCADE,
  yjs_state text NOT NULL,
  label text NOT NULL DEFAULT 'Auto-save',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_snapshots_project_date
  ON cxd_project_snapshots (project_id, created_at DESC);

-- RLS
ALTER TABLE cxd_project_snapshots ENABLE ROW LEVEL SECURITY;

-- Owner + collaborators can read snapshots
CREATE POLICY "snapshot_select" ON cxd_project_snapshots FOR SELECT USING (
  project_id IN (
    SELECT id FROM cxd_projects WHERE owner_id = auth.uid()
  )
  OR project_id IN (
    SELECT canvas_id FROM canvas_collaborators WHERE user_id = auth.uid()
  )
);

-- Owner + collaborators can create snapshots
CREATE POLICY "snapshot_insert" ON cxd_project_snapshots FOR INSERT WITH CHECK (
  project_id IN (
    SELECT id FROM cxd_projects WHERE owner_id = auth.uid()
  )
  OR project_id IN (
    SELECT canvas_id FROM canvas_collaborators WHERE user_id = auth.uid()
  )
);

-- Only owner can delete snapshots
CREATE POLICY "snapshot_delete" ON cxd_project_snapshots FOR DELETE USING (
  project_id IN (
    SELECT id FROM cxd_projects WHERE owner_id = auth.uid()
  )
);
```

- [ ] **Step 2: Apply migration to Supabase**

Run the migration against the Supabase project via the dashboard SQL editor or CLI. Verify the table exists:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'cxd_project_snapshots' ORDER BY ordinal_position;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20240401000001_project_snapshots.sql
git commit -m "feat(snapshots): add cxd_project_snapshots table with RLS"
```

---

### Task 2: Snapshot Service

**Files:**
- Create: `src/lib/yjs/snapshot-service.ts`

- [ ] **Step 1: Create the snapshot service**

```typescript
'use client';

import { createClient } from '@/supabase/client';

export interface SnapshotMeta {
  id: string;
  project_id: string;
  label: string;
  created_by: string | null;
  created_at: string;
}

const MAX_SNAPSHOTS_PER_PROJECT = 20;

/**
 * Create a snapshot of the current yjs_state for a project.
 * Reads the current state from cxd_projects and copies it to cxd_project_snapshots.
 * Prunes oldest snapshots beyond MAX_SNAPSHOTS_PER_PROJECT.
 */
export async function createSnapshot(
  projectId: string,
  label: string,
  userId?: string
): Promise<boolean> {
  try {
    const supabase = createClient();

    // Read current yjs_state from the project
    const { data: project, error: fetchError } = await supabase
      .from('cxd_projects')
      .select('yjs_state')
      .eq('id', projectId)
      .single();

    if (fetchError || !project?.yjs_state) {
      console.warn('[Snapshot] No yjs_state to snapshot for project:', projectId);
      return false;
    }

    // Insert the snapshot
    const { error: insertError } = await supabase
      .from('cxd_project_snapshots')
      .insert({
        project_id: projectId,
        yjs_state: project.yjs_state,
        label,
        created_by: userId || null,
      });

    if (insertError) {
      console.error('[Snapshot] Failed to create snapshot:', insertError);
      return false;
    }

    // Prune: delete oldest snapshots beyond the limit
    await pruneSnapshots(projectId);

    console.log('[Snapshot] Created:', label, 'for project:', projectId);
    return true;
  } catch (err) {
    console.error('[Snapshot] Error creating snapshot:', err);
    return false;
  }
}

/**
 * List snapshot metadata for a project (newest first).
 * Does NOT include yjs_state to keep the query lightweight.
 */
export async function listSnapshots(projectId: string): Promise<SnapshotMeta[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('cxd_project_snapshots')
      .select('id, project_id, label, created_by, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(MAX_SNAPSHOTS_PER_PROJECT);

    if (error) {
      console.error('[Snapshot] Failed to list snapshots:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[Snapshot] Error listing snapshots:', err);
    return [];
  }
}

/**
 * Load a snapshot's yjs_state and apply it to the active Y.Doc.
 * The Y.Doc change propagates automatically via bridge (Zustand),
 * provider (collaborators), and persistence (DB).
 */
export async function restoreSnapshot(
  snapshotId: string,
  doc: import('yjs').Doc
): Promise<boolean> {
  try {
    const Y = await import('yjs');
    const supabase = createClient();

    const { data, error } = await supabase
      .from('cxd_project_snapshots')
      .select('yjs_state')
      .eq('id', snapshotId)
      .single();

    if (error || !data?.yjs_state) {
      console.error('[Snapshot] Failed to load snapshot:', error);
      return false;
    }

    // Decode base64 to binary
    const binary = Uint8Array.from(atob(data.yjs_state), (c) => c.charCodeAt(0));

    // Create a fresh doc from the snapshot and merge into active doc.
    // This is a CRDT merge — the snapshot state is applied as an update.
    // Elements in the snapshot that were deleted in the current doc will be restored.
    // To get a true "revert", we need to replace the doc content entirely.
    const snapshotDoc = new Y.Doc();
    Y.applyUpdate(snapshotDoc, binary);

    // Clear all current content from the active doc, then apply snapshot
    doc.transact(() => {
      // Clear elements map
      const yElements = doc.getMap('elements');
      yElements.forEach((_, key) => yElements.delete(key));

      // Clear edges map
      const yEdges = doc.getMap('edges');
      yEdges.forEach((_, key) => yEdges.delete(key));

      // Apply snapshot elements
      const snapElements = snapshotDoc.getMap('elements');
      snapElements.forEach((value, key) => {
        yElements.set(key, value instanceof Y.Map ? value.clone() : value);
      });

      // Apply snapshot edges
      const snapEdges = snapshotDoc.getMap('edges');
      snapEdges.forEach((value, key) => {
        yEdges.set(key, value instanceof Y.Map ? value.clone() : value);
      });

      // Apply snapshot meta fields
      const snapMeta = snapshotDoc.getMap('meta');
      const yMeta = doc.getMap('meta');
      snapMeta.forEach((value, key) => {
        yMeta.set(key, value);
      });

      // Apply snapshot reality planes
      const snapRP = snapshotDoc.getArray('realityPlanesV2');
      const yRP = doc.getArray('realityPlanesV2');
      if (snapRP.length > 0) {
        yRP.delete(0, yRP.length);
        for (let i = 0; i < snapRP.length; i++) {
          const item = snapRP.get(i);
          yRP.push([item instanceof Y.Map ? item.clone() : item]);
        }
      }

      // Apply snapshot experience flow stages
      const snapStages = snapshotDoc.getArray('experienceFlowStages');
      const yStages = doc.getArray('experienceFlowStages');
      if (snapStages.length > 0) {
        yStages.delete(0, yStages.length);
        for (let i = 0; i < snapStages.length; i++) {
          const item = snapStages.get(i);
          yStages.push([item instanceof Y.Map ? item.clone() : item]);
        }
      }
    }, 'snapshot-restore');

    snapshotDoc.destroy();
    console.log('[Snapshot] Restored snapshot:', snapshotId);
    return true;
  } catch (err) {
    console.error('[Snapshot] Error restoring snapshot:', err);
    return false;
  }
}

/**
 * Delete a specific snapshot.
 */
export async function deleteSnapshot(snapshotId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('cxd_project_snapshots')
      .delete()
      .eq('id', snapshotId);

    if (error) {
      console.error('[Snapshot] Failed to delete snapshot:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Snapshot] Error deleting snapshot:', err);
    return false;
  }
}

/**
 * Remove oldest snapshots beyond the per-project limit.
 */
async function pruneSnapshots(projectId: string): Promise<void> {
  try {
    const supabase = createClient();

    // Get all snapshot IDs ordered by newest first
    const { data: all, error } = await supabase
      .from('cxd_project_snapshots')
      .select('id')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error || !all) return;

    // Delete any beyond the limit
    const toDelete = all.slice(MAX_SNAPSHOTS_PER_PROJECT);
    if (toDelete.length === 0) return;

    const ids = toDelete.map((s) => s.id);
    await supabase
      .from('cxd_project_snapshots')
      .delete()
      .in('id', ids);

    console.log('[Snapshot] Pruned', ids.length, 'old snapshots');
  } catch (err) {
    console.error('[Snapshot] Error pruning snapshots:', err);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep snapshot-service || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/lib/yjs/snapshot-service.ts
git commit -m "feat(snapshots): add snapshot service with create/list/restore/delete/prune"
```

---

### Task 3: Auto-Snapshot Triggers

**Files:**
- Modify: `src/contexts/yjs-project-context.tsx`
- Modify: `src/lib/yjs/supabase-persistence.ts`

- [ ] **Step 1: Add auto-snapshot triggers to YjsProjectProvider**

In `src/contexts/yjs-project-context.tsx`, add the import at the top with other imports:

```typescript
import { createSnapshot } from '@/lib/yjs/snapshot-service';
```

Add a ref for the snapshot timer and last snapshot time after the existing refs (around line 60):

```typescript
const snapshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
const lastSnapshotTimeRef = useRef<number>(0);
```

Add a helper function inside the `YjsProjectProvider` component, before the main `useEffect`:

```typescript
const createAutoSnapshot = useCallback(async (label: string, minIntervalMs = 300000) => {
  const now = Date.now();
  if (now - lastSnapshotTimeRef.current < minIntervalMs) return; // 5 min debounce by default
  const pid = currentProjectIdRef.current;
  if (!pid) return;
  lastSnapshotTimeRef.current = now;
  // Fire-and-forget — don't block the caller
  createSnapshot(pid, label).catch((err) =>
    console.warn('[YjsProject] Auto-snapshot failed:', err)
  );
}, []);
```

Inside the `.then()` callback, after `setIsReady(true)` (around line 175), start the 30-min auto-snapshot timer:

```typescript
// Start auto-snapshot timer (every 30 minutes)
snapshotIntervalRef.current = setInterval(() => {
  createAutoSnapshot('Auto-save');
}, 30 * 60 * 1000);
```

Update the `handleVisibilityChange` handler (around line 109) to also create a snapshot:

```typescript
const handleVisibilityChange = () => {
  if (document.visibilityState === 'hidden') {
    supabasePersistenceRef.current?.flush();
    createAutoSnapshot('Tab close');
  }
};
```

In the `cleanup()` function (around line 205), add snapshot on project switch and clear the timer:

```typescript
function cleanup() {
  // Clear auto-snapshot timer
  if (snapshotIntervalRef.current) {
    clearInterval(snapshotIntervalRef.current);
    snapshotIntervalRef.current = null;
  }

  if (supabasePersistenceRef.current) {
    // Snapshot before destroying (project switch)
    const pid = currentProjectIdRef.current;
    if (pid && isReady) {
      createSnapshot(pid, 'Project switch').catch(() => {});
    }
    supabasePersistenceRef.current.destroy();
    supabasePersistenceRef.current = null;
  }
  // ... rest of existing cleanup unchanged
}
```

- [ ] **Step 2: Add pre-load snapshot to SupabasePersistence**

In `src/lib/yjs/supabase-persistence.ts`, add the import at the top:

```typescript
import { createSnapshot } from './snapshot-service';
```

In the `load()` method (around line 66), before applying the update, snapshot the existing DB state:

```typescript
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

    // Safety net: snapshot the existing DB state before we load it.
    // If something goes wrong during this session, the pre-load state is recoverable.
    createSnapshot(this.projectId, 'Pre-load backup').catch(() => {});

    // yjs_state is stored as a base64-encoded binary
    const binary = Uint8Array.from(atob(data.yjs_state), (c) => c.charCodeAt(0));
    Y.applyUpdate(this.doc, binary, 'persistence');
    this.lastLoadedState = binary;
    return true;
  } catch (err) {
    console.error('[SupabasePersistence] Failed to load Y.Doc state:', err);
    return false;
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "yjs-project-context|supabase-persistence" || echo "No errors"`

- [ ] **Step 4: Commit**

```bash
git add src/contexts/yjs-project-context.tsx src/lib/yjs/supabase-persistence.ts
git commit -m "feat(snapshots): add auto-snapshot triggers on timer, tab close, project switch, pre-load"
```

---

### Task 4: Version History Panel UI

**Files:**
- Create: `src/components/cxd/version-history-panel.tsx`

- [ ] **Step 1: Create the Version History panel component**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Save, RotateCcw, Trash2, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listSnapshots, createSnapshot, restoreSnapshot, deleteSnapshot, type SnapshotMeta } from '@/lib/yjs/snapshot-service';
import type { Doc } from 'yjs';

interface VersionHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  yDoc: Doc | null;
  userId?: string;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function VersionHistoryPanel({ open, onClose, projectId, yDoc, userId }: VersionHistoryPanelProps) {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [showCheckpointInput, setShowCheckpointInput] = useState(false);
  const [checkpointLabel, setCheckpointLabel] = useState('');

  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    const data = await listSnapshots(projectId);
    setSnapshots(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (open) {
      fetchSnapshots();
    }
  }, [open, fetchSnapshots]);

  const handleSaveCheckpoint = async () => {
    setSaving(true);
    const label = checkpointLabel.trim()
      ? `Manual: ${checkpointLabel.trim()}`
      : 'Manual checkpoint';
    await createSnapshot(projectId, label, userId);
    setCheckpointLabel('');
    setShowCheckpointInput(false);
    setSaving(false);
    await fetchSnapshots();
  };

  const handleRestore = async (snapshotId: string) => {
    if (!yDoc) return;
    setRestoringId(snapshotId);
    const success = await restoreSnapshot(snapshotId, yDoc);
    setRestoringId(null);
    setConfirmRestoreId(null);
    if (success) {
      onClose();
    }
  };

  const handleDelete = async (snapshotId: string) => {
    await deleteSnapshot(snapshotId);
    await fetchSnapshots();
  };

  if (!open) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-[360px] z-[60] flex flex-col bg-black/90 backdrop-blur-xl border-l border-white/10 shadow-2xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">Version History</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
            onClick={() => setShowCheckpointInput(!showCheckpointInput)}
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            Save Checkpoint
          </Button>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Checkpoint input */}
      {showCheckpointInput && (
        <div className="px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex gap-2">
            <Input
              value={checkpointLabel}
              onChange={(e) => setCheckpointLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveCheckpoint()}
              placeholder="Label (optional)..."
              className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30"
              autoFocus
            />
            <Button
              size="sm"
              className="h-8 px-3 text-xs bg-purple-600 hover:bg-purple-500"
              onClick={handleSaveCheckpoint}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {/* Snapshot list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
          </div>
        ) : snapshots.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Clock className="w-8 h-8 text-white/20 mx-auto mb-3" />
            <p className="text-sm text-white/40">No snapshots yet.</p>
            <p className="text-xs text-white/25 mt-1">Snapshots are created automatically as you work.</p>
          </div>
        ) : (
          <div className="py-2">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white/80 truncate">{snap.label}</p>
                    <p className="text-[10px] text-white/40 mt-0.5" title={new Date(snap.created_at).toLocaleString()}>
                      {timeAgo(snap.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {confirmRestoreId === snap.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          className="h-6 px-2 text-[10px] bg-amber-600 hover:bg-amber-500"
                          onClick={() => handleRestore(snap.id)}
                          disabled={restoringId === snap.id}
                        >
                          {restoringId === snap.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Confirm'
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px] text-white/50 hover:text-white"
                          onClick={() => setConfirmRestoreId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px] text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                          onClick={() => setConfirmRestoreId(snap.id)}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-white/30 hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => handleDelete(snap.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {confirmRestoreId === snap.id && (
                  <p className="text-[10px] text-amber-400/80 mt-1.5">
                    This will overwrite the current state for all collaborators.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep version-history-panel || echo "No errors"`

- [ ] **Step 3: Commit**

```bash
git add src/components/cxd/version-history-panel.tsx
git commit -m "feat(snapshots): add Version History side panel component"
```

---

### Task 5: Wire UI Into Account Menu and Navbar

**Files:**
- Modify: `src/components/cxd/account-menu.tsx`
- Modify: `src/components/cxd/cxd-navbar.tsx`

- [ ] **Step 1: Add Version History item to account menu**

In `src/components/cxd/account-menu.tsx`, add `History` to the lucide-react import (line 15 area):

```typescript
  History,
```

Add the prop to `AccountMenuProps` interface (after `onOpenSettings`):

```typescript
  onOpenVersionHistory?: () => void;
```

Add it to the destructured props (after `onOpenSettings`):

```typescript
  onOpenVersionHistory,
```

Add the menu item after the Settings `DropdownMenuItem` (after line 228, replacing the templates comment):

```tsx
        {/* Templates menu item — hidden until templates are production-ready */}

        {onOpenVersionHistory && (
          <DropdownMenuItem
            onClick={onOpenVersionHistory}
            className="hover:bg-white/5 cursor-pointer text-white/80 hover:text-white px-4 py-2.5"
          >
            <History className="w-4 h-4 mr-3" />
            Version History
          </DropdownMenuItem>
        )}
```

- [ ] **Step 2: Wire the panel into cxd-navbar**

In `src/components/cxd/cxd-navbar.tsx`, add the import at the top with other component imports:

```typescript
import { VersionHistoryPanel } from './version-history-panel';
```

Add state for the panel (around line 228, near the other panel states):

```typescript
const [showVersionHistory, setShowVersionHistory] = useState(false);
```

Get yDoc and currentProjectId from the store (add to existing useCXDStore usage at the top of the component):

```typescript
const yDoc = useCXDStore((s) => s.yDoc);
```

Pass the callback to AccountMenu (around line 844, add after `onOpenSettings`):

```typescript
            onOpenVersionHistory={() => setShowVersionHistory(true)}
```

Render the panel (after the existing template picker comment, around line 876):

```tsx
      {/* Version History Panel */}
      {showVersionHistory && project && (
        <VersionHistoryPanel
          open={showVersionHistory}
          onClose={() => setShowVersionHistory(false)}
          projectId={project.id}
          yDoc={yDoc}
        />
      )}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "account-menu|cxd-navbar" || echo "No errors"`

- [ ] **Step 4: Run production build**

Run: `npx next build 2>&1 | tail -10`
Expected: Build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/cxd/account-menu.tsx src/components/cxd/cxd-navbar.tsx
git commit -m "feat(snapshots): wire Version History panel into account menu and navbar"
```

---

### Task 6: Final Build Verification and Push

**Files:** None (verification only)

- [ ] **Step 1: Run full production build**

Run: `npx next build 2>&1 | tail -15`
Expected: `Compiled successfully` with no type errors.

- [ ] **Step 2: Commit any remaining changes and push**

```bash
git status
git push origin Antigravity-Branch
```
