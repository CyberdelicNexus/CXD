-- Add user name and email to credit tables for easier tracking
-- This helps with analytics and customer support

-- Add columns to ai_credits table
ALTER TABLE public.ai_credits
  ADD COLUMN IF NOT EXISTS user_name TEXT,
  ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Add columns to ai_credit_transactions table
ALTER TABLE public.ai_credit_transactions
  ADD COLUMN IF NOT EXISTS user_name TEXT,
  ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Function to sync user info from auth.users to ai_credits
CREATE OR REPLACE FUNCTION sync_user_info_to_credits()
RETURNS void AS $$
BEGIN
  UPDATE public.ai_credits ac
  SET
    user_name = COALESCE(
      (SELECT full_name FROM public.users WHERE id = ac.user_id),
      (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = ac.user_id),
      split_part((SELECT email FROM auth.users WHERE id = ac.user_id), '@', 1)
    ),
    user_email = (SELECT email FROM auth.users WHERE id = ac.user_id)
  WHERE user_name IS NULL OR user_email IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update subscription tier and credits when plan changes
CREATE OR REPLACE FUNCTION update_credits_on_subscription_change()
RETURNS TRIGGER AS $$
DECLARE
  v_new_allowance INT;
  v_lifetime_bonus INT := 0;
BEGIN
  -- Determine new credit allowance based on plan
  CASE NEW.plan_id
    WHEN 'free' THEN
      v_new_allowance := 50;  -- Free tier gets 50 monthly credits (Gemini Flash only)
    WHEN 'pro' THEN
      v_new_allowance := 500;  -- Pro gets 500 monthly credits (all models except Opus)
    WHEN 'lifetime' THEN
      v_new_allowance := 0;  -- Lifetime gets no monthly credits
      v_lifetime_bonus := 1000;  -- But gets 1000 one-time credits + BYOK
    WHEN 'beta_tester' THEN
      v_new_allowance := 500;  -- Beta testers get Pro benefits
    ELSE
      v_new_allowance := 50;  -- Default to Free tier
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
    v_lifetime_bonus,
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
    -- Only add lifetime bonus if upgrading TO lifetime (not if already lifetime)
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

  -- Log the subscription change in transactions
  IF NEW.plan_id != OLD.plan_id THEN
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
      CASE WHEN NEW.plan_id = 'lifetime' AND OLD.plan_id != 'lifetime' THEN v_lifetime_bonus ELSE 0 END,
      (SELECT monthly_allowance + addon_credits - used_this_period FROM public.ai_credits WHERE user_id = NEW.user_id),
      'Subscription plan changed from ' || OLD.plan_id || ' to ' || NEW.plan_id,
      'manual_adjustment',
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

-- Create trigger for subscription changes
DROP TRIGGER IF EXISTS on_subscription_change ON public.subscriptions;
CREATE TRIGGER on_subscription_change
  AFTER INSERT OR UPDATE OF plan_id ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_credits_on_subscription_change();

-- Sync existing records
SELECT sync_user_info_to_credits();

-- Grant permissions
GRANT EXECUTE ON FUNCTION sync_user_info_to_credits() TO service_role;
GRANT EXECUTE ON FUNCTION update_credits_on_subscription_change() TO service_role;

-- Comments
COMMENT ON COLUMN public.ai_credits.user_name IS 'User display name for analytics and support';
COMMENT ON COLUMN public.ai_credits.user_email IS 'User email for analytics and support';
COMMENT ON COLUMN public.ai_credit_transactions.user_name IS 'User display name at time of transaction';
COMMENT ON COLUMN public.ai_credit_transactions.user_email IS 'User email at time of transaction';
COMMENT ON FUNCTION update_credits_on_subscription_change() IS 'Automatically updates credit allowances when subscription plan changes';
