-- Free tier AI credit drip: 0 monthly -> 25 monthly (see src/lib/plans.ts PLANS.FREE).
--
-- Root cause of "free account shows 0 AI credits": update_credits_on_subscription_change()
-- (from 20240310000001_fix_signup_bonus_credits.sql) hardcodes the free tier's
-- monthly_allowance to 0 in SQL, independent of src/lib/plans.ts. EVERY user gets a
-- 'free' row inserted into public.subscriptions at signup (see
-- 20240205000003_safe_user_trigger.sql), which fires this trigger immediately — so
-- every free user's ai_credits row was created with monthly_allowance = 0 regardless
-- of what the TypeScript plan config says. The app-level resync in
-- /api/ai/credits (route.ts) only runs at natural period rollover (~30 days), so it
-- never corrected already-provisioned rows.
--
-- This migration updates the trigger to grant the monthly drip going forward, and
-- backfills existing free users whose allowance is still stuck at 0. The one-time
-- signup bonus (addon_credits) is untouched — it was already granted correctly and
-- backfilling it again would double-grant.

CREATE OR REPLACE FUNCTION update_credits_on_subscription_change()
RETURNS TRIGGER AS $$
DECLARE
  v_new_allowance INT;
  v_signup_bonus INT := 0;
  v_lifetime_bonus INT := 0;
  v_is_new_user BOOLEAN;
BEGIN
  v_is_new_user := (TG_OP = 'INSERT');

  CASE NEW.plan_id
    WHEN 'free' THEN
      v_new_allowance := 25;  -- Monthly drip (keep in sync with PLANS.FREE.limits.monthlyAICredits)
      IF v_is_new_user THEN
        v_signup_bonus := 50;  -- One-time 50 credit signup bonus
      END IF;
    WHEN 'pro' THEN
      v_new_allowance := 500;  -- Pro gets 500 monthly credits (all models except Opus)
    WHEN 'lifetime' THEN
      v_new_allowance := 0;  -- Lifetime gets no monthly credits
      IF (v_is_new_user AND NEW.plan_id = 'lifetime') OR
         (NOT v_is_new_user AND OLD.plan_id != 'lifetime') THEN
        v_lifetime_bonus := 1000;  -- One-time 1000 credits + BYOK enabled
      END IF;
    WHEN 'beta_tester' THEN
      v_new_allowance := 500;  -- Beta testers get Pro benefits
    ELSE
      v_new_allowance := 25;  -- Default to Free tier's monthly drip
      IF v_is_new_user THEN
        v_signup_bonus := 50;  -- Default signup bonus
      END IF;
  END CASE;

  INSERT INTO public.ai_credits (
    user_id,
    monthly_allowance,
    addon_credits,
    user_name,
    user_email,
    period_start,
    period_end
  ) VALUES (
    NEW.user_id,
    v_new_allowance,
    v_signup_bonus + v_lifetime_bonus,
    COALESCE(
      (SELECT full_name FROM public.users WHERE id = NEW.user_id),
      (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = NEW.user_id),
      split_part((SELECT email FROM auth.users WHERE id = NEW.user_id), '@', 1)
    ),
    (SELECT email FROM auth.users WHERE id = NEW.user_id),
    NOW(),
    NOW() + INTERVAL '1 month'
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    monthly_allowance = v_new_allowance,
    addon_credits = CASE
      WHEN NEW.plan_id = 'lifetime' AND OLD.plan_id != 'lifetime' THEN
        public.ai_credits.addon_credits + v_lifetime_bonus
      ELSE
        public.ai_credits.addon_credits
    END,
    user_name = COALESCE(
      (SELECT full_name FROM public.users WHERE id = NEW.user_id),
      (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = NEW.user_id),
      split_part((SELECT email FROM auth.users WHERE id = NEW.user_id), '@', 1)
    ),
    user_email = (SELECT email FROM auth.users WHERE id = NEW.user_id);

  IF v_is_new_user OR (NEW.plan_id != OLD.plan_id) THEN
    INSERT INTO public.ai_credit_transactions (
      user_id,
      amount,
      balance_after,
      reason,
      transaction_type,
      user_name,
      user_email
    ) VALUES (
      NEW.user_id,
      v_signup_bonus + v_lifetime_bonus,
      (SELECT monthly_allowance + addon_credits - used_this_period FROM public.ai_credits WHERE user_id = NEW.user_id),
      CASE
        WHEN v_is_new_user AND v_signup_bonus > 0 THEN
          'New user signup bonus: ' || v_signup_bonus || ' credits'
        WHEN v_is_new_user AND v_lifetime_bonus > 0 THEN
          'New lifetime member bonus: ' || v_lifetime_bonus || ' credits'
        WHEN NOT v_is_new_user AND NEW.plan_id = 'lifetime' THEN
          'Upgraded to lifetime: +' || v_lifetime_bonus || ' credits'
        ELSE
          'Subscription plan changed from ' || OLD.plan_id || ' to ' || NEW.plan_id
      END,
      CASE
        WHEN v_signup_bonus > 0 THEN 'signup_bonus'
        WHEN v_lifetime_bonus > 0 THEN 'lifetime_bonus'
        ELSE 'manual_adjustment'
      END,
      COALESCE(
        (SELECT full_name FROM public.users WHERE id = NEW.user_id),
        (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = NEW.user_id),
        split_part((SELECT email FROM auth.users WHERE id = NEW.user_id), '@', 1)
      ),
      (SELECT email FROM auth.users WHERE id = NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_subscription_change ON public.subscriptions;
CREATE TRIGGER on_subscription_change
  AFTER INSERT OR UPDATE OF plan_id ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_credits_on_subscription_change();

GRANT EXECUTE ON FUNCTION update_credits_on_subscription_change() TO service_role;

-- Backfill: give every currently-stuck-at-0 free user the monthly drip right away,
-- rather than making them wait up to 30 days for their period to roll over.
UPDATE public.ai_credits
SET monthly_allowance = 25
WHERE monthly_allowance = 0
AND user_id IN (
  SELECT user_id FROM public.subscriptions WHERE plan_id = 'free'
);

COMMENT ON FUNCTION update_credits_on_subscription_change() IS
'Automatically updates credit allowances when subscription changes.
Free: 25 monthly drip + 50 signup bonus (one-time)
Pro: 500 monthly
Lifetime: 0 monthly + 1000 bonus (one-time) + BYOK
Signup bonuses are only granted on initial user creation.';
