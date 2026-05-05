-- Fix infinite-recursion bug in canvas_collaborators SELECT policy.
--
-- The original policy from 20240106000001_collaboration_schema.sql:
--
--   CREATE POLICY "Collaborators can view other collaborators"
--     ON public.canvas_collaborators FOR SELECT
--     USING (
--       EXISTS (
--         SELECT 1 FROM public.canvas_collaborators cc
--         WHERE cc.canvas_id = canvas_collaborators.canvas_id
--           AND cc.user_id = auth.uid()
--       )
--     );
--
-- ...is self-referential: evaluating the policy queries the same table it
-- protects, which re-fires the same policy, which queries the table again,
-- etc. PostgreSQL detects and aborts with `42P17 infinite recursion detected
-- in policy for relation "canvas_collaborators"`.
--
-- This had been a latent bug for months; it only manifested after the
-- 20240425000006 migration dropped phantom policies on cxd_projects that
-- had been giving Postgres alternate evaluation paths.
--
-- The fix: a STABLE SECURITY DEFINER function that bypasses RLS internally,
-- combined with a non-recursive policy. Same access semantics, no recursion.

CREATE OR REPLACE FUNCTION public.user_collaborates_on_canvas(
  p_canvas_id uuid,
  p_user_id   uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.canvas_collaborators
    WHERE canvas_id = p_canvas_id AND user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_collaborates_on_canvas(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Collaborators can view other collaborators" ON public.canvas_collaborators;

CREATE POLICY "Collaborators can view other collaborators"
  ON public.canvas_collaborators
  FOR SELECT TO authenticated
  USING (
    -- You can always see your own collaborator row.
    user_id = (SELECT auth.uid())
    -- Or see other collaborators on canvases you also collaborate on.
    -- Function bypasses RLS internally, no recursion.
    OR public.user_collaborates_on_canvas(canvas_collaborators.canvas_id, (SELECT auth.uid()))
  );
