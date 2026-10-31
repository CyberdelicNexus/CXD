-- Admin user management. All service-role-only.
--
-- plan_id is written only when it changes, because on_subscription_change fires
-- on any UPDATE OF plan_id and resets monthly_allowance. The edit rules here
-- must stay in step with src/lib/admin/plan-guard.ts.

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_source_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_source_check
  CHECK (plan_source IN ('stripe', 'nexus', 'admin'));

CREATE OR REPLACE FUNCTION public.admin_set_plan(
  p_actor uuid,
  p_target uuid,
  p_plan text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.subscriptions%ROWTYPE;
BEGIN
  PERFORM public.admin_require_role(p_actor, ARRAY['admin', 'owner']);

  IF p_plan NOT IN ('free', 'pro', 'beta_tester') THEN
    RAISE EXCEPTION 'invalid_plan';
  END IF;

  SELECT * INTO v_row FROM public.subscriptions WHERE user_id = p_target FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_subscription'; END IF;

  IF v_row.plan_id::text = 'lifetime' THEN RAISE EXCEPTION 'lifetime_plan'; END IF;
  IF v_row.stripe_subscription_id IS NOT NULL
     AND v_row.status::text NOT IN ('canceled', 'incomplete_expired') THEN
    RAISE EXCEPTION 'stripe_managed';
  END IF;
  IF v_row.plan_source = 'nexus' THEN RAISE EXCEPTION 'nexus_managed'; END IF;
  IF v_row.plan_id::text = p_plan THEN RAISE EXCEPTION 'no_change'; END IF;

  UPDATE public.subscriptions
     SET plan_id = p_plan::public.plan_type,
         status = 'active'::public.subscription_status,
         plan_source = CASE WHEN p_plan = 'free' THEN NULL ELSE 'admin' END
   WHERE user_id = p_target;

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, before, after, reason, outcome)
  VALUES (
    p_actor, 'plan.set', 'user', p_target::text,
    jsonb_build_object('plan', v_row.plan_id, 'source', v_row.plan_source),
    jsonb_build_object('plan', p_plan),
    p_reason, 'succeeded'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_credits(
  p_actor uuid,
  p_target uuid,
  p_amount integer,
  p_reason text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_addon integer;
  v_allowance integer;
  v_used integer;
  v_new integer;
BEGIN
  PERFORM public.admin_require_role(p_actor, ARRAY['admin', 'owner']);

  SELECT addon_credits, monthly_allowance, used_this_period
    INTO v_addon, v_allowance, v_used
    FROM public.ai_credits WHERE user_id = p_target FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_credit_record'; END IF;

  v_new := v_addon + p_amount;
  IF v_new < 0 THEN RAISE EXCEPTION 'negative_balance'; END IF;

  UPDATE public.ai_credits SET addon_credits = v_new WHERE user_id = p_target;

  INSERT INTO public.ai_credit_transactions (user_id, amount, balance_after, reason, transaction_type)
  VALUES (p_target, p_amount, v_allowance + v_new - v_used, 'Admin: ' || p_reason, 'manual_adjustment');

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, before, after, reason, outcome)
  VALUES (
    p_actor, 'credits.adjust', 'user', p_target::text,
    jsonb_build_object('addon_credits', v_addon), jsonb_build_object('addon_credits', v_new),
    p_reason, 'succeeded'
  );

  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search text DEFAULT NULL,
  p_plan text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  plan_id text,
  role text,
  used_this_period integer,
  monthly_allowance integer,
  addon_credits integer,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  created_at timestamptz,
  total bigint
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
    COALESCE(s.plan_id::text, 'free'),
    r.role,
    c.used_this_period,
    c.monthly_allowance,
    c.addon_credits,
    u.last_sign_in_at,
    u.banned_until,
    u.created_at,
    count(*) OVER ()
  FROM auth.users u
  LEFT JOIN public.users p ON p.id = u.id
  LEFT JOIN public.subscriptions s ON s.user_id = u.id
  LEFT JOIN public.ai_credits c ON c.user_id = u.id
  LEFT JOIN public.staff_roles r ON r.user_id = u.id
  WHERE (
      p_search IS NULL OR p_search = ''
      OR position(lower(p_search) IN lower(u.email)) > 0
      OR position(lower(p_search) IN lower(COALESCE(p.full_name, p.name, ''))) > 0
    )
    AND (p_plan IS NULL OR COALESCE(s.plan_id::text, 'free') = p_plan)
    AND (p_role IS NULL OR r.role = p_role)
  ORDER BY u.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_plan(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_users(text, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_plan(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, text, integer, integer) TO service_role;
