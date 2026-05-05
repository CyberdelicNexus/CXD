-- Drop final phantom RLS policy on canvas_collaborators.
--
-- "Users can view collaborators" wasn't in any migration — created via the
-- Supabase dashboard (verified by SELECT FROM pg_policies finding it
-- alongside our migration-defined policies). It targets {public} (anon +
-- authenticated) and queries cxd_projects, which queries canvas_collaborators
-- back via its own SELECT policy → recursion (42P17) the moment any
-- canvas_collaborators read happens.
--
-- After 20240425000007 fixed the canvas_collaborators SELECT policy to
-- bypass RLS via SECURITY DEFINER function, this phantom kept the recursion
-- alive on its own evaluation path. Dropping it removes the last known
-- recursion source.
--
-- The migration-defined "Collaborators can view other collaborators" policy
-- covers the same access semantics correctly and without recursion, so this
-- drop is purely cleanup with no functional change.

DROP POLICY IF EXISTS "Users can view collaborators" ON public.canvas_collaborators;
