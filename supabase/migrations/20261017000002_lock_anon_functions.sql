-- Lock the SECURITY DEFINER functions signed-out visitors can call, and the
-- AI knowledge library they could overwrite.
--
-- The hole: every function below held EXECUTE for PUBLIC, anon and
-- authenticated (Postgres grants PUBLIC by default; the live project also
-- granted the two API roles). Each one runs as its owner (postgres) and
-- skips RLS, so anyone with the public anon key could call it through
-- /rest/v1/rpc/<name>:
--   * upsert_knowledge_chunk: insert or overwrite any row of
--     public.knowledge_cache, the Notion-synced reference text that
--     src/lib/ai/knowledge-retrieval.ts injects into AI system prompts as
--     trusted context (prompt injection for every member's AI chat).
--   * fetch_notion_pages / fetch_notion_blocks: read the Notion workspace
--     through the wrappers FDW tables public.page / public.block. Direct
--     reads of those tables already fail for anon (no access to the vault
--     secret), but the definer functions read them as postgres.
--   * search_knowledge: read the whole knowledge library.
--   * mark_api_key_used(p_user_id, ...): touch any user's BYOK key row.
--   * get_canvas_role(p_canvas_id, p_user_id) / can_add_collaborator:
--     oracle on any canvas's owner, collaborators, share state and the
--     owner's plan.
--   * sync_user_info_to_credits: copies auth.users emails into ai_credits.
--
-- Who calls what (checked against src/, supabase/functions/, every
-- migration, live RLS policies, live function bodies, views and cron.job):
--   * upsert_knowledge_chunk: only supabase/functions/sync-knowledge
--     (service-role client).
--   * search_knowledge: only src/lib/ai/knowledge-retrieval.ts, which already
--     uses getSupabaseAdmin() (service role).
--   * fetch_notion_*, mark_api_key_used, get_canvas_role,
--     can_add_collaborator, sync_user_info_to_credits: no caller anywhere.
--   * user_collaborates_on_canvas: used by the RLS policy "Collaborators can
--     view other collaborators" on canvas_collaborators (TO authenticated).
--     Policies run as the querying role, so authenticated keeps EXECUTE;
--     only PUBLIC and anon lose it.
-- So no app code changes ship with this migration and it can be applied as
-- soon as the code on main is what production runs (nothing on main calls
-- these with a member or anon session). Ship order: confirm production is on
-- main at or after this PR, then apply. Independent of 20261017000001.
--
-- knowledge_cache: RLS is on and the only policy is SELECT
-- "Authenticated users can read active knowledge" (TO public, so anon reads
-- it too). The table still carried INSERT/UPDATE/DELETE/TRUNCATE grants for
-- anon and authenticated; RLS blocked direct writes, but they go too, along
-- with anon SELECT. After this only service_role writes it, via the sync job.
--
-- public.page / public.block (Notion FDW foreign tables, no RLS possible)
-- carried full grants for anon and authenticated. Nothing in the app reads
-- them (the sync job calls the Notion API directly), so those go too.
--
-- Left as is: patch_project_data (SECURITY INVOKER, RLS applies),
-- bridge_list_projects / bridge_read_projects (authenticated only, pinned
-- auth.uid() check), trigger and event-trigger functions (not callable
-- through the API), and the credit/plan RPCs (20261017000001).

-- ---------------------------------------------------------------------------
-- Functions: service_role only
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fn text;
  proc regprocedure;
  fns text[] := ARRAY[
    'public.upsert_knowledge_chunk(text, integer, text, text, text, text, text[], extensions.vector, integer, integer, timestamp with time zone)',
    'public.upsert_knowledge_chunk(text, integer, text, text, text, text, text[], public.vector, integer, integer, timestamp with time zone)',
    'public.search_knowledge(extensions.vector, integer, double precision, text, text[])',
    'public.search_knowledge(public.vector, integer, double precision, text, text[])',
    'public.fetch_notion_pages()',
    'public.fetch_notion_blocks(text)',
    'public.mark_api_key_used(uuid, text)',
    'public.get_canvas_role(uuid, uuid)',
    'public.can_add_collaborator(uuid)',
    'public.sync_user_info_to_credits()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      proc := to_regprocedure(fn);
    EXCEPTION WHEN OTHERS THEN
      proc := NULL; -- e.g. the vector type lives in the other schema
    END;
    IF proc IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', proc);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', proc);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- RLS helper: authenticated (policy role) + service_role
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.user_collaborates_on_canvas(uuid, uuid)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.user_collaborates_on_canvas(uuid, uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.user_collaborates_on_canvas(uuid, uuid) TO authenticated, service_role;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  IF to_regclass('public.knowledge_cache') IS NOT NULL THEN
    -- Drop any write policy for the API roles (none on the live project
    -- today; this guards against one added by hand).
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'knowledge_cache'
        AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
        AND roles && ARRAY['public', 'anon', 'authenticated']::name[]
    LOOP
      EXECUTE format('DROP POLICY %I ON public.knowledge_cache', pol.policyname);
    END LOOP;

    REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
      ON public.knowledge_cache FROM anon, authenticated;
    REVOKE SELECT ON public.knowledge_cache FROM anon;
    GRANT ALL ON public.knowledge_cache TO service_role;
  END IF;

  IF to_regclass('public.page') IS NOT NULL THEN
    REVOKE ALL ON public.page FROM anon, authenticated;
  END IF;

  IF to_regclass('public.block') IS NOT NULL THEN
    REVOKE ALL ON public.block FROM anon, authenticated;
  END IF;
END $$;
