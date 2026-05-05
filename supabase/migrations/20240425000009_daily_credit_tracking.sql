-- Daily AI credit tracking: per-user safety cap + atomic deduction.
--
-- Why: monthly_allowance already caps total spend per user, but it doesn't
-- prevent burning the entire monthly budget in a single hour (script abuse,
-- compromised key, runaway loop). A daily cap forces the spend to spread
-- out, giving us time to react if something goes wrong.
--
-- Two new columns on ai_credits:
--   used_today      — credits deducted since today_reset_at
--   today_reset_at  — timestamp of last daily reset (UTC midnight)
--
-- The deduct_ai_credits RPC is updated to:
--   1. Reset used_today to 0 if today_reset_at predates UTC midnight
--   2. Enforce daily cap (passed by caller) — refuse if exceeded
--   3. Atomically increment used_today alongside used_this_period

ALTER TABLE public.ai_credits
  ADD COLUMN IF NOT EXISTS used_today      INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS today_reset_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- New deduct_ai_credits with optional daily cap. Existing two-arg signature
-- is preserved for backward compatibility (cap = NULL → no daily check).
CREATE OR REPLACE FUNCTION deduct_ai_credits(
  p_user_id   UUID,
  p_cost      INT,
  p_daily_cap INT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_monthly_allowance INT;
  v_addon_credits     INT;
  v_used_this_period  INT;
  v_used_today        INT;
  v_today_reset_at    TIMESTAMPTZ;
  v_total_available   INT;
  v_new_balance       INT;
  v_today_start       TIMESTAMPTZ := date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
  -- Lock the user's credit row for the duration of this transaction.
  SELECT
    monthly_allowance,
    addon_credits,
    used_this_period,
    used_today,
    today_reset_at
  INTO
    v_monthly_allowance,
    v_addon_credits,
    v_used_this_period,
    v_used_today,
    v_today_reset_at
  FROM public.ai_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_credits_record',
      'message', 'Credit record not found for user'
    );
  END IF;

  -- Reset daily counter if last reset predates today's UTC midnight.
  IF v_today_reset_at < v_today_start THEN
    v_used_today := 0;
    v_today_reset_at := NOW();
  END IF;

  -- Daily safety cap (if caller passed one).
  IF p_daily_cap IS NOT NULL AND (v_used_today + p_cost) > p_daily_cap THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'daily_cap_reached',
      'used_today', v_used_today,
      'daily_cap', p_daily_cap,
      'message', 'Daily AI usage limit reached. Resets at UTC midnight.'
    );
  END IF;

  v_total_available := (v_monthly_allowance + v_addon_credits) - v_used_this_period;

  IF v_total_available < p_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'available', v_total_available,
      'required', p_cost
    );
  END IF;

  UPDATE public.ai_credits
  SET used_this_period = used_this_period + p_cost,
      used_today       = v_used_today + p_cost,
      today_reset_at   = v_today_reset_at
  WHERE user_id = p_user_id;

  v_new_balance := v_total_available - p_cost;

  RETURN jsonb_build_object(
    'success',     true,
    'balance',     v_new_balance,
    'deducted',    p_cost,
    'used_today',  v_used_today + p_cost,
    'daily_cap',   p_daily_cap
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION deduct_ai_credits(UUID, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION deduct_ai_credits(UUID, INT, INT) TO authenticated;

COMMENT ON FUNCTION deduct_ai_credits(UUID, INT, INT) IS
'Atomic credit deduction with daily safety cap. Locks the user row, resets
the daily counter at UTC midnight, refuses if either monthly or daily limit
would be exceeded. Pass NULL for p_daily_cap to skip the daily check.';

-- Helper: aggregate org-wide credits used in a window. Used by the cost
-- monitoring cron. Returns total credits + a breakdown by user (top N).
CREATE OR REPLACE FUNCTION get_org_daily_credit_usage()
RETURNS TABLE (
  total_credits BIGINT,
  active_users  BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(used_today), 0)::BIGINT AS total_credits,
    COUNT(*) FILTER (WHERE used_today > 0)::BIGINT AS active_users
  FROM public.ai_credits
  WHERE today_reset_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
$$;

GRANT EXECUTE ON FUNCTION get_org_daily_credit_usage() TO service_role;
