-- Fix credit allocation to match plan configuration
-- Free tier: 0 monthly + 50 signup bonus (one-time)
-- Pro tier: 500 monthly
-- Lifetime tier: 0 monthly + 1000 lifetime credits
-- This migration aligns the database with src/lib/plans.ts

-- Update the subscription change trigger to properly handle signup bonuses
CREATE OR REPLACE FUNCTION update_credits_on_subscription_change()
RETURNS TRIGGER AS $$
DECLARE
  v_new_allowance INT;
  v_signup_bonus INT := 0;
  v_lifetime_bonus INT := 0;
  v_is_new_user BOOLEAN;
BEGIN
  -- Check if this is a new user (INSERT) or plan change (UPDATE)
  v_is_new_user := (TG_OP = 'INSERT');

  -- Determine new credit allowance based on plan
  CASE NEW.plan_id
    WHEN 'free' THEN
      v_new_allowance := 0;  -- Free tier gets NO monthly credits
      -- Only give signup bonus to new users
      IF v_is_new_user THEN
        v_signup_bonus := 50;  -- One-time 50 credit signup bonus
      END IF;
    WHEN 'pro' THEN
      v_new_allowance := 500;  -- Pro gets 500 monthly credits (all models except Opus)
    WHEN 'lifetime' THEN
      v_new_allowance := 0;  -- Lifetime gets no monthly credits
      -- Only give lifetime bonus when upgrading TO lifetime
      IF (v_is_new_user AND NEW.plan_id = 'lifetime') OR
         (NOT v_is_new_user AND OLD.plan_id != 'lifetime') THEN
        v_lifetime_bonus := 1000;  -- One-time 1000 credits + BYOK enabled
      END IF;
    WHEN 'beta_tester' THEN
      v_new_allowance := 500;  -- Beta testers get Pro benefits
    ELSE
      v_new_allowance := 0;  -- Default to Free tier (no monthly credits)
      IF v_is_new_user THEN
        v_signup_bonus := 50;  -- Default signup bonus
      END IF;
  END CASE;

  -- Update or insert ai_credits record
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
    v_signup_bonus + v_lifetime_bonus,  -- Both bonuses are one-time addon credits
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
    -- Add signup/lifetime bonus only for new situations
    addon_credits = CASE
      -- Upgrading to lifetime from non-lifetime plan
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

  -- Log the subscription change/creation in transactions
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

-- Recreate the trigger (in case it needs to be refreshed)
DROP TRIGGER IF EXISTS on_subscription_change ON public.subscriptions;
CREATE TRIGGER on_subscription_change
  AFTER INSERT OR UPDATE OF plan_id ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_credits_on_subscription_change();

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_credits_on_subscription_change() TO service_role;

-- Update existing free tier users to have 0 monthly allowance
-- (They keep their addon credits which should already include the signup bonus)
UPDATE public.ai_credits
SET monthly_allowance = 0
WHERE user_id IN (
  SELECT user_id FROM public.subscriptions WHERE plan_id = 'free'
)
AND monthly_allowance = 50;

-- Add comment explaining the new system
COMMENT ON FUNCTION update_credits_on_subscription_change() IS
'Automatically updates credit allowances when subscription changes.
Free: 0 monthly + 50 signup bonus (one-time)
Pro: 500 monthly
Lifetime: 0 monthly + 1000 bonus (one-time) + BYOK
Signup bonuses are only granted on initial user creation.';
