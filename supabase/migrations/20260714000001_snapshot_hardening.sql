-- Snapshot hardening (July 2026 data-loss incident follow-up)
--
-- 1. Metadata columns so the restore UI can show what each snapshot contains
--    (element/edge counts) and so the client can dedupe identical snapshots
--    (content_hash) instead of spamming a copy on every load/tab-hide.
-- 2. project_data capture column: client snapshots store yjs_state only (it is
--    canonical under the unified writer); the server guard below captures BOTH
--    columns so even a corrupted yjs_state universe leaves a recoverable copy.
-- 3. A server-side guard trigger on cxd_projects: the last line of defense.
--    Every client-side protection (reconciliation, wipe guard, telemetry) runs
--    in code that a future bug can bypass — this trigger cannot be bypassed by
--    any writer. If an UPDATE would drop the element count to less than half
--    of what it was (and at least 4 elements would vanish), the OLD row is
--    archived into cxd_project_snapshots BEFORE the update commits. The update
--    itself is never blocked (mass-delete is a legitimate user action); we
--    just guarantee the prior state survives it.

ALTER TABLE cxd_project_snapshots
  ADD COLUMN IF NOT EXISTS element_count integer,
  ADD COLUMN IF NOT EXISTS edge_count integer,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS project_data jsonb;

CREATE INDEX IF NOT EXISTS idx_snapshots_project_created
  ON cxd_project_snapshots (project_id, created_at DESC);

CREATE OR REPLACE FUNCTION guard_project_element_drop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_count integer;
  new_count integer;
BEGIN
  old_count := COALESCE(jsonb_array_length(OLD.project_data->'canvasLayout'->'elements'), 0);
  new_count := COALESCE(jsonb_array_length(NEW.project_data->'canvasLayout'->'elements'), 0);

  IF old_count >= 4 AND new_count < (old_count / 2) THEN
    BEGIN
      INSERT INTO cxd_project_snapshots
        (project_id, yjs_state, project_data, label, element_count, edge_count)
      VALUES (
        OLD.id,
        -- yjs_state is NOT NULL in the snapshots table, but legacy rows may
        -- lack one — and those are precisely the rows most at risk. An empty
        -- yjs_state with full project_data is still a complete archive.
        COALESCE(OLD.yjs_state, ''),
        OLD.project_data,
        'Server guard: pre-drop archive (' || old_count || ' -> ' || new_count || ' elements)',
        old_count,
        COALESCE(jsonb_array_length(OLD.project_data->'canvasLayout'->'edges'), 0)
      );
    EXCEPTION WHEN OTHERS THEN
      -- The guard must never break a save; archive failure is logged, not fatal.
      RAISE WARNING 'guard_project_element_drop archive failed for %: %', OLD.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_project_element_drop ON cxd_projects;
CREATE TRIGGER trg_guard_project_element_drop
  BEFORE UPDATE OF project_data ON cxd_projects
  FOR EACH ROW
  EXECUTE FUNCTION guard_project_element_drop();

COMMENT ON FUNCTION guard_project_element_drop IS
  'Archives the previous row state into cxd_project_snapshots before any UPDATE that would drop the canvas element count by more than half. Never blocks the update. Added after the July 2026 silent data-loss incident.';
