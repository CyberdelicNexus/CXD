-- Admin dashboard. Service-role-only.
--
-- admin_daily_metrics holds what cannot be rebuilt later: auth.users keeps only
-- the last sign-in, Stripe has no past MRR, and credit usage resets each period.

CREATE TABLE IF NOT EXISTS public.admin_daily_metrics (
  day date PRIMARY KEY,
  active_7d integer NOT NULL,
  active_30d integer NOT NULL,
  -- Null when Stripe could not be read, so a chart shows a gap and not a false zero.
  mrr_cents jsonb,
  paying_users integer NOT NULL,
  comped_users integer NOT NULL,
  free_users integer NOT NULL,
  credits_used_period integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_daily_metrics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_daily_metrics FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.admin_daily_metrics TO service_role;

CREATE OR REPLACE FUNCTION public.admin_attention_summary(p_days integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'openTickets', (SELECT count(*) FROM public.support_tickets WHERE status <> 'done'),
    'highPriorityTickets', (SELECT count(*) FROM public.support_tickets WHERE status <> 'done' AND priority = 'high'),
    'unresolvedErrors', (SELECT count(*) FROM public.fix_pipeline WHERE decision IS NULL),
    'failedPayments', (SELECT count(*) FROM public.subscriptions WHERE status::text IN ('past_due', 'unpaid')),
    'failedEmails',
      (SELECT COALESCE(sum(failed_count), 0) FROM public.broadcasts WHERE created_at >= now() - make_interval(days => p_days))
      + (SELECT count(*) FROM public.support_ticket_events WHERE kind = 'delivery_failed' AND created_at >= now() - make_interval(days => p_days))
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_summary(p_days integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH days AS (
    SELECT generate_series(
      (now() AT TIME ZONE 'utc')::date - (p_days - 1),
      (now() AT TIME ZONE 'utc')::date,
      interval '1 day'
    )::date AS day
  ),
  signups AS (
    SELECT (created_at AT TIME ZONE 'utc')::date AS day, count(*) AS n FROM auth.users GROUP BY 1
  ),
  canvases AS (
    SELECT (created_at AT TIME ZONE 'utc')::date AS day, count(*) AS n FROM public.cxd_projects GROUP BY 1
  ),
  active AS (
    SELECT id::text AS user_id, last_sign_in_at AS at FROM auth.users
    UNION ALL
    SELECT owner_id::text, updated_at FROM public.cxd_projects
  )
  SELECT jsonb_build_object(
    'totalUsers', (SELECT count(*) FROM auth.users),
    'totalCanvases', (SELECT count(*) FROM public.cxd_projects),
    'signupsByDay', (SELECT jsonb_agg(jsonb_build_object('day', d.day, 'value', COALESCE(s.n, 0)) ORDER BY d.day) FROM days d LEFT JOIN signups s USING (day)),
    'canvasesByDay', (SELECT jsonb_agg(jsonb_build_object('day', d.day, 'value', COALESCE(c.n, 0)) ORDER BY d.day) FROM days d LEFT JOIN canvases c USING (day)),
    'active7d', (SELECT count(DISTINCT user_id) FROM active WHERE at >= now() - interval '7 days'),
    'active30d', (SELECT count(DISTINCT user_id) FROM active WHERE at >= now() - interval '30 days'),
    'creditsUsedPeriod', (SELECT COALESCE(sum(used_this_period), 0) FROM public.ai_credits),
    'feedbackCount', (SELECT count(*) FROM public.canvas_assistant_feedback WHERE created_at >= now() - make_interval(days => p_days)),
    'trackedEmails', (SELECT count(*) FROM public.email_log WHERE sent_at >= now() - make_interval(days => p_days)),
    'planRows', (
      SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb) FROM (
        SELECT plan_id::text AS plan_id, status::text AS status,
               stripe_subscription_id IS NOT NULL AS has_stripe_subscription,
               plan_source, count(*) AS n
          FROM public.subscriptions GROUP BY 1, 2, 3, 4
      ) p
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.admin_attention_summary(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_analytics_summary(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_attention_summary(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_analytics_summary(integer) TO service_role;
