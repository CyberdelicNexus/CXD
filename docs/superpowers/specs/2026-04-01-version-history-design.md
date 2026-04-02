# Version History — Design Spec

## Problem

Canvas project state can be lost when Y.Doc persistence overwrites newer data with stale state, or when collaboration sync has timing issues. Users have no way to recover previous work.

## Solution

Auto-snapshot system that captures Y.Doc state at key moments, stores up to 20 snapshots per project in Supabase, and provides a UI to browse and restore any snapshot.

---

## Database

### New table: `cxd_project_snapshots`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, default gen_random_uuid() |
| `project_id` | uuid | FK → cxd_projects.id, ON DELETE CASCADE |
| `yjs_state` | text | Base64-encoded Y.Doc binary (same format as cxd_projects.yjs_state) |
| `label` | text | "Auto-save", "Tab close", "Project switch", "Manual: <user label>" |
| `created_by` | uuid | Nullable, FK → auth.users(id) |
| `created_at` | timestamptz | Default now() |

**Index:** `(project_id, created_at DESC)` for fast retrieval.

**RLS policies:** Mirror cxd_projects access — owner + collaborators can SELECT and INSERT. Only owner can DELETE.

**Pruning:** On insert, delete oldest rows beyond 20 per project. Implemented in the service layer, not as a DB trigger.

---

## Snapshot Service

**File:** `src/lib/yjs/snapshot-service.ts`

### Methods

#### `createSnapshot(projectId: string, label: string, userId?: string): Promise<boolean>`
1. Read current `yjs_state` from `cxd_projects` WHERE id = projectId
2. If no yjs_state exists, skip (nothing to snapshot)
3. INSERT into `cxd_project_snapshots` with the copied yjs_state
4. Prune: DELETE oldest snapshots beyond 20 for this project
5. Return success/failure

#### `listSnapshots(projectId: string): Promise<Snapshot[]>`
1. SELECT id, label, created_by, created_at FROM cxd_project_snapshots WHERE project_id = projectId ORDER BY created_at DESC LIMIT 20
2. No yjs_state in list query (keep it lightweight)
3. Return array of snapshot metadata

#### `restoreSnapshot(snapshotId: string, projectId: string, activeDoc: Y.Doc): Promise<boolean>`
1. SELECT yjs_state FROM cxd_project_snapshots WHERE id = snapshotId
2. Decode base64 to Uint8Array
3. Apply to the active Y.Doc via `Y.applyUpdate(activeDoc, binary, 'snapshot-restore')`
4. The Y.Doc change propagates automatically:
   - Bridge pushes to Zustand (local UI updates)
   - SupabaseYjsProvider broadcasts to collaborators
   - SupabasePersistence saves to DB
5. Return success/failure

#### `deleteSnapshot(snapshotId: string): Promise<boolean>`
1. DELETE FROM cxd_project_snapshots WHERE id = snapshotId
2. Return success/failure

---

## Auto-Snapshot Triggers

All triggers are integrated into existing lifecycle code. Each trigger calls `snapshotService.createSnapshot()`.

### 1. 30-minute timer
- **Where:** `YjsProjectProvider`, started after `setIsReady(true)`
- **Logic:** `setInterval` every 30 minutes. Skip if no Y.Doc changes since last snapshot (track via a `lastSnapshotStateVector` compared with current).
- **Label:** "Auto-save"
- **Cleanup:** Clear interval on provider cleanup

### 2. Tab close / visibility hidden
- **Where:** Existing `visibilitychange` handler in `yjs-project-context.tsx`
- **Logic:** On `document.visibilityState === 'hidden'`, create snapshot before flushing persistence
- **Label:** "Tab close"
- **Debounce:** Skip if a snapshot was created within the last 5 minutes (avoid rapid snapshots from tab switching)

### 3. Project switch
- **Where:** `cleanup()` function in `YjsProjectProvider`
- **Logic:** Before destroying the Y.Doc, snapshot the current state
- **Label:** "Project switch"
- **Guard:** Only if Y.Doc is ready and has been active for > 1 minute

### 4. Before Y.Doc load (safety net)
- **Where:** `SupabasePersistence.load()`, before `Y.applyUpdate`
- **Logic:** Before loading persisted state into Y.Doc, snapshot the current DB yjs_state
- **Label:** "Pre-load backup"
- **Guard:** Only if yjs_state already exists in DB (skip for new projects)

### 5. Manual checkpoint
- **Where:** Triggered from Version History panel UI
- **Label:** "Manual: <user-provided label>" or "Manual checkpoint" if no label

---

## UI Components

### 1. Account Menu Item

**File:** `src/components/cxd/account-menu.tsx`

- New menu item below "Settings": icon `History`, text "Version History"
- Prop: `onOpenVersionHistory?: () => void`
- Only shown when `onOpenVersionHistory` is provided

### 2. Version History Panel

**File:** `src/components/cxd/version-history-panel.tsx`

Side panel that slides in from the right.

**Props:**
- `open: boolean`
- `onClose: () => void`
- `projectId: string`
- `yDoc: Y.Doc | null`

**Layout:**
- **Header:** "Version History" title, close button (X), "Save Checkpoint" button
- **Snapshot list:** Scrollable list, newest first. Each item shows:
  - Relative timestamp ("2 hours ago") with absolute time on hover tooltip
  - Label text
  - Creator name (if available, fetched from users table)
  - "Restore" button (right-aligned)
- **Restore flow:** Clicking "Restore" shows inline confirmation: "Restore this version? This will overwrite current state for all collaborators." with Confirm/Cancel buttons.
- **Save checkpoint flow:** Clicking "Save Checkpoint" shows an inline text input for optional label, then "Save" button.
- **Empty state:** "No snapshots yet. Snapshots are created automatically as you work."
- **Loading state:** Skeleton rows while fetching

**Styling:** Match existing panel patterns (glassmorphism, dark theme, purple accents).

### 3. Navbar Wiring

**File:** `src/components/cxd/cxd-navbar.tsx`

- New state: `const [showVersionHistory, setShowVersionHistory] = useState(false)`
- Pass `onOpenVersionHistory={() => setShowVersionHistory(true)}` to AccountMenu
- Render `<VersionHistoryPanel>` conditionally when `showVersionHistory` is true

---

## Migration

**File:** `supabase/migrations/YYYYMMDD_project_snapshots.sql`

```sql
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

---

## Out of Scope (V1)

- Visual preview/diff of snapshots
- IndexedDB local snapshot caching
- Snapshot export/download
- Snapshot branching (fork from a snapshot)
- Automatic snapshot comparison
