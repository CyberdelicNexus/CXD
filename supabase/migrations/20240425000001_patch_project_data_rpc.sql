-- Atomic JSONB merge for project metadata updates.
-- Replaces the read-modify-write pattern in updateProjectMetadata which
-- could lose concurrent edits (last-write-wins on the JS-side merge).
--
-- The `||` operator on jsonb is atomic at the row level inside an UPDATE,
-- so two concurrent calls can't drop each other's keys.
--
-- SECURITY INVOKER: runs as the calling user, so RLS policies on
-- cxd_projects (owners + collaborators with editor role) still apply.

CREATE OR REPLACE FUNCTION patch_project_data(
  p_id    uuid,
  p_patch jsonb
) RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE cxd_projects
     SET project_data = COALESCE(project_data, '{}'::jsonb) || p_patch,
         updated_at   = NOW()
   WHERE id = p_id;
$$;

GRANT EXECUTE ON FUNCTION patch_project_data(uuid, jsonb) TO authenticated;
