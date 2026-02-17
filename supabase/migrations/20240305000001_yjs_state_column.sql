-- Add yjs_state column to projects table for binary Y.Doc persistence
-- This stores the full Y.Doc state as a base64-encoded binary string.
-- When populated, the Yjs CRDT system uses this instead of project_data for sync.

ALTER TABLE cxd_projects ADD COLUMN IF NOT EXISTS yjs_state TEXT;

-- Add an index for projects that have yjs_state (for migration queries)
CREATE INDEX IF NOT EXISTS idx_cxd_projects_has_yjs_state
  ON cxd_projects ((yjs_state IS NOT NULL));

COMMENT ON COLUMN cxd_projects.yjs_state IS 'Base64-encoded Y.Doc binary state for CRDT-based collaboration. When present, this is the source of truth for canvas elements, edges, and design fields.';
