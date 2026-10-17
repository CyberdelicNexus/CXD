-- Release 1.5: trim the default table grants on the two tables the
-- feat/canvas-ai-assistant branch added, and pin refund_ai_credits to the
-- service role on any database built from the migration files.
--
-- Checked live (read-only) on 2026-10-17: both tables have RLS on, but carry
-- Supabase's default grants of every privilege, TRUNCATE included, to anon and
-- authenticated. RLS stops row reads and writes through the API; TRUNCATE is
-- not subject to RLS, so the grants go. Idempotent and safe to re-run.
--
-- fix_pipeline: written only by the service role (Inngest sentry functions,
-- Telegram webhook). No client access at all.
-- canvas_assistant_feedback: members insert and read their own events through
-- /api/ai/canvas-feedback with their session (owner-only RLS policies), so
-- authenticated keeps SELECT and INSERT; nothing else. The credit side of
-- that route (refund_ai_credits) runs as the service role.

REVOKE ALL ON TABLE public.fix_pipeline FROM anon, authenticated;

REVOKE ALL ON TABLE public.canvas_assistant_feedback FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.canvas_assistant_feedback TO authenticated;

-- 20261011000002 revoked PUBLIC and authenticated but not anon's explicit
-- default grant. Live it is already service-role only (20261017000001); this
-- makes a fresh database match.
DO $$
BEGIN
  IF to_regprocedure('public.refund_ai_credits(uuid, integer)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.refund_ai_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.refund_ai_credits(uuid, integer) TO service_role;
  END IF;
END $$;
