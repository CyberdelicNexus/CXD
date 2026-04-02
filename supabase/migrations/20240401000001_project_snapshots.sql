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
