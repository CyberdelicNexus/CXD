-- Restore public (anonymous) read access to shared projects.
--
-- Regression: 20240425000004_wrap_rls_auth_calls.sql dropped the policy
-- "Anyone can view shared projects" (which targeted {public} = anon +
-- authenticated) and folded its `share_token` clause into a new SELECT policy
-- scoped `TO authenticated` only. That silently removed anonymous access to
-- share links — a logged-out visitor opening /cxd/share/<token> matched no
-- SELECT policy for the `anon` role, so RLS returned 0 rows and the share page
-- showed "This share link may have expired or been revoked".
--
-- Public share links are meant to be viewed without an account, so we re-add a
-- dedicated anon-scoped read policy. It contains NO auth.uid()/auth.jwt() call,
-- so it keeps the perf characteristics the rewrap migration was after (RLS does
-- not evaluate any auth function for anon traffic here). The authenticated
-- SELECT policy already carries the same `share_token` OR-clause, so logged-in
-- users viewing shared links are unaffected.

DROP POLICY IF EXISTS "Anon can view shared projects" ON public.cxd_projects;

CREATE POLICY "Anon can view shared projects" ON public.cxd_projects
    FOR SELECT
    TO anon
    USING (share_token IS NOT NULL AND share_token != '');
