-- Drop phantom RLS policies on cxd_projects.
--
-- These two policies aren't in any migration file but exist in the live
-- database (verified by SELECT FROM pg_policies). They were almost certainly
-- created via the Supabase dashboard's RLS UI at some point and target
-- {public} (anon + authenticated) using unwrapped auth.uid() per row.
--
-- They don't BLOCK access — RLS combines policies with OR — but they:
--   1. Re-introduce the per-row auth.uid() perf cost the rewrap migration eliminated
--   2. Grant access via paths not visible in source control (drift hazard)
--
-- The policies created by 20240425000004_wrap_rls_auth_calls.sql cover the
-- same access semantics correctly and with the perf wrap, so dropping these
-- is purely cleanup with no functional change.

DROP POLICY IF EXISTS "Owners and collaborators can update projects" ON public.cxd_projects;
DROP POLICY IF EXISTS "Owners can always view own projects" ON public.cxd_projects;
