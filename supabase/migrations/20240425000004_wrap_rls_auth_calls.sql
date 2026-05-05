-- Performance: wrap every auth.uid() / auth.jwt() / auth.role() call in (SELECT ...)
-- so Postgres treats it as a constant initPlan (evaluated once per query, cached)
-- instead of re-invoking the function per row. Also adds explicit `TO authenticated`
-- so RLS doesn't run at all for anon traffic.
--
-- Reference: Supabase RLS performance rule `rls-wrap-functions-select`.
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- This is a logically-equivalent rewrite — same access semantics, faster execution.
-- Each table is wrapped in its own DO block guarded by to_regclass() so the
-- migration is robust to missing tables (e.g. older feature migrations not
-- applied to this database). Missing tables are skipped with a NOTICE.

-- ==========================================================================
-- public.cxd_projects
-- ==========================================================================
DO $$
BEGIN
  IF to_regclass('public.cxd_projects') IS NULL THEN
    RAISE NOTICE 'Skipping cxd_projects RLS rewrap — table does not exist';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Users can view owned and collaborated projects" ON public.cxd_projects;
  DROP POLICY IF EXISTS "Users can insert own projects" ON public.cxd_projects;
  DROP POLICY IF EXISTS "Users can update owned and collaborated projects" ON public.cxd_projects;
  DROP POLICY IF EXISTS "Only owners can delete projects" ON public.cxd_projects;
  DROP POLICY IF EXISTS "Users can view own projects" ON public.cxd_projects;
  DROP POLICY IF EXISTS "Users can update own projects" ON public.cxd_projects;
  DROP POLICY IF EXISTS "Users can delete own projects" ON public.cxd_projects;
  DROP POLICY IF EXISTS "Anyone can view shared projects" ON public.cxd_projects;

  CREATE POLICY "Users can view owned and collaborated projects" ON public.cxd_projects
    FOR SELECT TO authenticated USING (
      (SELECT auth.uid()) = owner_id
      OR EXISTS (
        SELECT 1 FROM public.canvas_collaborators
        WHERE canvas_collaborators.canvas_id = cxd_projects.id
          AND canvas_collaborators.user_id = (SELECT auth.uid())
      )
      OR (share_token IS NOT NULL AND share_token != '')
    );

  CREATE POLICY "Users can insert own projects" ON public.cxd_projects
    FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = owner_id);

  CREATE POLICY "Users can update owned and collaborated projects" ON public.cxd_projects
    FOR UPDATE TO authenticated USING (
      (SELECT auth.uid()) = owner_id
      OR EXISTS (
        SELECT 1 FROM public.canvas_collaborators
        WHERE canvas_collaborators.canvas_id = cxd_projects.id
          AND canvas_collaborators.user_id = (SELECT auth.uid())
      )
    );

  CREATE POLICY "Only owners can delete projects" ON public.cxd_projects
    FOR DELETE TO authenticated USING ((SELECT auth.uid()) = owner_id);
END $$;

-- ==========================================================================
-- public.canvas_collaborators
-- ==========================================================================
DO $$
BEGIN
  IF to_regclass('public.canvas_collaborators') IS NULL THEN
    RAISE NOTICE 'Skipping canvas_collaborators RLS rewrap — table does not exist';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Collaborators can view other collaborators" ON public.canvas_collaborators;
  DROP POLICY IF EXISTS "Owners can insert collaborators" ON public.canvas_collaborators;
  DROP POLICY IF EXISTS "Owners can delete collaborators" ON public.canvas_collaborators;

  CREATE POLICY "Collaborators can view other collaborators" ON public.canvas_collaborators
    FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM public.canvas_collaborators cc
        WHERE cc.canvas_id = canvas_collaborators.canvas_id
          AND cc.user_id = (SELECT auth.uid())
      )
    );

  CREATE POLICY "Owners can insert collaborators" ON public.canvas_collaborators
    FOR INSERT TO authenticated WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.cxd_projects p
        WHERE p.id = canvas_id AND p.owner_id = (SELECT auth.uid())
      )
    );

  CREATE POLICY "Owners can delete collaborators" ON public.canvas_collaborators
    FOR DELETE TO authenticated USING (
      EXISTS (
        SELECT 1 FROM public.cxd_projects p
        WHERE p.id = canvas_id AND p.owner_id = (SELECT auth.uid())
      )
      OR user_id = (SELECT auth.uid())
    );
END $$;

-- ==========================================================================
-- public.canvas_invitations
-- ==========================================================================
DO $$
BEGIN
  IF to_regclass('public.canvas_invitations') IS NULL THEN
    RAISE NOTICE 'Skipping canvas_invitations RLS rewrap — table does not exist';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Owners can view invitations" ON public.canvas_invitations;
  DROP POLICY IF EXISTS "Users can view their pending invitations" ON public.canvas_invitations;
  DROP POLICY IF EXISTS "Owners can insert invitations" ON public.canvas_invitations;
  DROP POLICY IF EXISTS "Owners can update invitations" ON public.canvas_invitations;
  DROP POLICY IF EXISTS "Service role can manage invitations" ON public.canvas_invitations;

  CREATE POLICY "Owners can view invitations" ON public.canvas_invitations
    FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM public.cxd_projects p
        WHERE p.id = canvas_id AND p.owner_id = (SELECT auth.uid())
      )
    );

  CREATE POLICY "Users can view their pending invitations" ON public.canvas_invitations
    FOR SELECT TO authenticated USING (
      invited_email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND status = 'pending'
      AND expires_at > NOW()
    );

  CREATE POLICY "Owners can insert invitations" ON public.canvas_invitations
    FOR INSERT TO authenticated WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.cxd_projects p
        WHERE p.id = canvas_id AND p.owner_id = (SELECT auth.uid())
      )
    );

  CREATE POLICY "Owners can update invitations" ON public.canvas_invitations
    FOR UPDATE TO authenticated USING (
      EXISTS (
        SELECT 1 FROM public.cxd_projects p
        WHERE p.id = canvas_id AND p.owner_id = (SELECT auth.uid())
      )
    );

  -- Service-role policy: target service_role explicitly. The original auth.role()
  -- check was redundant since service_role bypasses RLS anyway, but semantics preserved.
  CREATE POLICY "Service role can manage invitations" ON public.canvas_invitations
    FOR ALL TO service_role USING (true);
END $$;

-- ==========================================================================
-- public.ai_chat_threads
-- ==========================================================================
DO $$
BEGIN
  IF to_regclass('public.ai_chat_threads') IS NULL THEN
    RAISE NOTICE 'Skipping ai_chat_threads RLS rewrap — table does not exist';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Users can view own threads" ON public.ai_chat_threads;
  DROP POLICY IF EXISTS "Users can insert own threads" ON public.ai_chat_threads;
  DROP POLICY IF EXISTS "Users can update own threads" ON public.ai_chat_threads;
  DROP POLICY IF EXISTS "Users can delete own threads" ON public.ai_chat_threads;

  CREATE POLICY "Users can view own threads" ON public.ai_chat_threads
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

  CREATE POLICY "Users can insert own threads" ON public.ai_chat_threads
    FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

  CREATE POLICY "Users can update own threads" ON public.ai_chat_threads
    FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

  CREATE POLICY "Users can delete own threads" ON public.ai_chat_threads
    FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
END $$;

-- ==========================================================================
-- public.ai_credits
-- ==========================================================================
DO $$
BEGIN
  IF to_regclass('public.ai_credits') IS NULL THEN
    RAISE NOTICE 'Skipping ai_credits RLS rewrap — table does not exist';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Users can view own credits" ON public.ai_credits;
  DROP POLICY IF EXISTS "Users can update own credits" ON public.ai_credits;
  DROP POLICY IF EXISTS "Users can insert own credits" ON public.ai_credits;

  CREATE POLICY "Users can view own credits" ON public.ai_credits
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

  CREATE POLICY "Users can update own credits" ON public.ai_credits
    FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

  CREATE POLICY "Users can insert own credits" ON public.ai_credits
    FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
END $$;

-- ==========================================================================
-- public.ai_credit_transactions
-- ==========================================================================
DO $$
BEGIN
  IF to_regclass('public.ai_credit_transactions') IS NULL THEN
    RAISE NOTICE 'Skipping ai_credit_transactions RLS rewrap — table does not exist';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Users can view own transactions" ON public.ai_credit_transactions;
  DROP POLICY IF EXISTS "Users can insert own transactions" ON public.ai_credit_transactions;

  CREATE POLICY "Users can view own transactions" ON public.ai_credit_transactions
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

  CREATE POLICY "Users can insert own transactions" ON public.ai_credit_transactions
    FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
END $$;

-- ==========================================================================
-- public.user_api_keys (BYOK — only present if 20240308000001 was applied)
-- ==========================================================================
DO $$
BEGIN
  IF to_regclass('public.user_api_keys') IS NULL THEN
    RAISE NOTICE 'Skipping user_api_keys RLS rewrap — table does not exist (BYOK migration not applied)';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Users can view own API keys" ON public.user_api_keys;
  DROP POLICY IF EXISTS "Users can insert own API keys" ON public.user_api_keys;
  DROP POLICY IF EXISTS "Users can update own API keys" ON public.user_api_keys;
  DROP POLICY IF EXISTS "Users can delete own API keys" ON public.user_api_keys;

  CREATE POLICY "Users can view own API keys" ON public.user_api_keys
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

  CREATE POLICY "Users can insert own API keys" ON public.user_api_keys
    FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

  CREATE POLICY "Users can update own API keys" ON public.user_api_keys
    FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

  CREATE POLICY "Users can delete own API keys" ON public.user_api_keys
    FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
END $$;

-- ==========================================================================
-- public.cxd_project_snapshots
-- ==========================================================================
DO $$
BEGIN
  IF to_regclass('public.cxd_project_snapshots') IS NULL THEN
    RAISE NOTICE 'Skipping cxd_project_snapshots RLS rewrap — table does not exist';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "snapshot_select" ON public.cxd_project_snapshots;
  DROP POLICY IF EXISTS "snapshot_insert" ON public.cxd_project_snapshots;
  DROP POLICY IF EXISTS "snapshot_delete" ON public.cxd_project_snapshots;

  CREATE POLICY "snapshot_select" ON public.cxd_project_snapshots
    FOR SELECT TO authenticated USING (
      project_id IN (
        SELECT id FROM public.cxd_projects WHERE owner_id = (SELECT auth.uid())
      )
      OR project_id IN (
        SELECT canvas_id FROM public.canvas_collaborators WHERE user_id = (SELECT auth.uid())
      )
    );

  CREATE POLICY "snapshot_insert" ON public.cxd_project_snapshots
    FOR INSERT TO authenticated WITH CHECK (
      project_id IN (
        SELECT id FROM public.cxd_projects WHERE owner_id = (SELECT auth.uid())
      )
      OR project_id IN (
        SELECT canvas_id FROM public.canvas_collaborators WHERE user_id = (SELECT auth.uid())
      )
    );

  CREATE POLICY "snapshot_delete" ON public.cxd_project_snapshots
    FOR DELETE TO authenticated USING (
      project_id IN (
        SELECT id FROM public.cxd_projects WHERE owner_id = (SELECT auth.uid())
      )
    );
END $$;

-- ==========================================================================
-- public.subscriptions
-- ==========================================================================
DO $$
BEGIN
  IF to_regclass('public.subscriptions') IS NULL THEN
    RAISE NOTICE 'Skipping subscriptions RLS rewrap — table does not exist';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
  DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
  DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscriptions;

  CREATE POLICY "Users can view own subscription" ON public.subscriptions
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

  CREATE POLICY "Users can update own subscription" ON public.subscriptions
    FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id);

  CREATE POLICY "Service role can manage subscriptions" ON public.subscriptions
    FOR ALL TO service_role USING (true);
END $$;

-- ==========================================================================
-- public.users (profile)
-- ==========================================================================
DO $$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE NOTICE 'Skipping users RLS rewrap — table does not exist';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
  DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

  CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);

  CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);
END $$;
