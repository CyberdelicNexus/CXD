-- Admin broadcasts and email opt-outs. Service-role-only. Unsubscribing needs
-- no login, so it is a route using a signed token, not an RLS policy.

CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  marketing_opt_out boolean NOT NULL DEFAULT false,
  opted_out_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The composer makes one key per draft. A double click or a retry hits the
  -- unique constraint, so the same send cannot go out twice.
  idempotency_key uuid NOT NULL UNIQUE,
  sender_id uuid NOT NULL,
  channels text[] NOT NULL,
  category text CHECK (category IN ('product', 'service')),
  audience jsonb NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  -- Emails (or, for in-app only, notifications) handed on by the fan-out job so far.
  enqueued_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  -- Set once when the fan-out could not finish, so history shows why there is a shortfall.
  failure_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON public.broadcasts (created_at DESC);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.email_preferences FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.broadcasts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.email_preferences TO service_role;
GRANT SELECT, INSERT ON public.broadcasts TO service_role;

CREATE OR REPLACE FUNCTION public.admin_recipients(
  p_plan text DEFAULT NULL,
  p_user_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  email text,
  name text,
  email_confirmed boolean,
  banned boolean,
  opted_out boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    u.id,
    u.email::text,
    COALESCE(p.full_name, p.name),
    u.email_confirmed_at IS NOT NULL,
    COALESCE(u.banned_until > now(), false),
    COALESCE(e.marketing_opt_out, false)
  FROM auth.users u
  LEFT JOIN public.users p ON p.id = u.id
  LEFT JOIN public.subscriptions s ON s.user_id = u.id
  LEFT JOIN public.email_preferences e ON e.user_id = u.id
  WHERE (p_plan IS NULL OR COALESCE(s.plan_id::text, 'free') = p_plan)
    AND (p_user_ids IS NULL OR u.id = ANY (p_user_ids))
  -- A stable order, so the caller can page past PostgREST's row cap without gaps or repeats.
  ORDER BY u.id;
$$;

-- Workers finish in any order, so counts must increment in the database.
CREATE OR REPLACE FUNCTION public.admin_record_broadcast_result(
  p_broadcast uuid,
  p_sent integer,
  p_failed integer
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.broadcasts
     SET sent_count = sent_count + p_sent,
         failed_count = failed_count + p_failed
   WHERE id = p_broadcast;
$$;

-- The fan-out job reports progress here. p_enqueued is the running total, taken from
-- fixed chunk positions, so a step that runs twice reports the same number and the
-- count never moves backwards. p_recipient_count, when given, replaces the
-- count taken at send time with the count that was actually reachable at fan-out
-- (someone may have unsubscribed since the preview).
CREATE OR REPLACE FUNCTION public.admin_record_broadcast_progress(
  p_broadcast uuid,
  p_enqueued integer,
  p_recipient_count integer DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.broadcasts
     SET enqueued_count = GREATEST(enqueued_count, p_enqueued),
         recipient_count = COALESCE(p_recipient_count, recipient_count)
   WHERE id = p_broadcast;
$$;

-- The fan-out could not finish: everything not yet enqueued counts as failed.
-- Runs once per broadcast; a repeat call changes nothing.
CREATE OR REPLACE FUNCTION public.admin_fail_broadcast(
  p_broadcast uuid,
  p_note text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.broadcasts
     SET failed_count = failed_count + GREATEST(recipient_count - enqueued_count, 0),
         failure_note = p_note
   WHERE id = p_broadcast
     AND failure_note IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_recipients(text, uuid[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_record_broadcast_result(uuid, integer, integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_record_broadcast_progress(uuid, integer, integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_fail_broadcast(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_recipients(text, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_record_broadcast_result(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_record_broadcast_progress(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_fail_broadcast(uuid, text) TO service_role;
