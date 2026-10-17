-- Lock member writes to billing / entitlement / credit state.
--
-- The hole: public.subscriptions had "Users can update own subscription"
-- (FOR UPDATE TO authenticated USING (auth.uid() = user_id), no WITH CHECK)
-- plus full table grants to anon and authenticated, so any signed-in user
-- could set their own plan_id = 'lifetime' (or status, founding_member_number,
-- stripe_*) from the browser with the anon key. That policy was created by
-- hand on the live project; it is not in any earlier migration.
--
-- The same pattern let members grant themselves AI credits:
--   * ai_credits: "Users can insert own credits" / "Users can update own
--     credits" (any column: monthly_allowance, addon_credits, used_this_period).
--   * ai_credit_transactions: "Users can insert own transactions" (forged
--     ledger rows).
--   * SECURITY DEFINER credit/plan RPCs executable by anon and authenticated
--     with a caller-supplied p_user_id and no auth check. deduct_ai_credits /
--     consume_credits accept a negative cost (= free credits) or another
--     user's id (= drain them); refund_ai_credits, add_ai_credits, grant_trial,
--     upgrade_to_pro, upgrade_to_lifetime hand out credits / tiers outright.
--
-- After this migration only service_role writes these tables and calls these
-- functions. The app does every legitimate write server-side with the
-- service-role client after authenticating the caller with getUser():
--   cancelSubscriptionAction, /api/subscriptions/free-primary-canvas,
--   /api/stripe/create-checkout, /api/stripe/create-credit-checkout,
--   /api/ai/credits (GET provision/reset/self-heal, PUT model),
--   every /api/ai/* deduct_ai_credits call, /api/ai/credits/ledger.
-- Ship that code BEFORE applying this migration: the old code writes with the
-- member's session and would fail here (and the AI routes fail open — they
-- log a deduct error and still serve the request).
--
-- Members keep SELECT on their own rows (existing own-row SELECT policies).
-- Nothing reads these tables signed-out, so anon loses SELECT too.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
      ON public.subscriptions FROM anon, authenticated;
    REVOKE SELECT ON public.subscriptions FROM anon;
  END IF;

  IF to_regclass('public.ai_credits') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can insert own credits" ON public.ai_credits;
    DROP POLICY IF EXISTS "Users can update own credits" ON public.ai_credits;
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
      ON public.ai_credits FROM anon, authenticated;
    REVOKE SELECT ON public.ai_credits FROM anon;
  END IF;

  IF to_regclass('public.ai_credit_transactions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can insert own transactions" ON public.ai_credit_transactions;
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
      ON public.ai_credit_transactions FROM anon, authenticated;
    REVOKE SELECT ON public.ai_credit_transactions FROM anon;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Credit / plan RPCs: service_role only. PUBLIC holds EXECUTE by default, so
-- it is revoked from PUBLIC as well as the two API roles.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.deduct_ai_credits(uuid, integer)',
    'public.deduct_ai_credits(uuid, integer, integer)',
    'public.consume_credits(uuid, integer, text, integer, integer, uuid, text)',
    'public.refund_ai_credits(uuid, integer)',
    'public.add_ai_credits(uuid, integer)',
    'public.grant_trial(uuid)',
    'public.upgrade_to_pro(uuid, text, text)',
    'public.upgrade_to_lifetime(uuid, text, integer)',
    'public.reset_monthly_credits()',
    'public.downgrade_expired_trials()',
    'public.get_org_daily_credit_usage()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END $$;
