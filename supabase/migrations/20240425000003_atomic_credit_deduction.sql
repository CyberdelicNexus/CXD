-- Make deduct_ai_credits atomic under concurrent chat requests.
--
-- The previous version did SELECT then UPDATE without locking. Two simultaneous
-- AI requests from the same user could both pass the balance check and both
-- deduct, taking the user negative (you eat the cost).
--
-- Fix: SELECT ... FOR UPDATE locks the user's row for the function's transaction.
-- Concurrent callers serialize per-user; other users are unaffected.

CREATE OR REPLACE FUNCTION deduct_ai_credits(
  p_user_id UUID,
  p_cost    INT
)
RETURNS JSONB AS $$
DECLARE
  v_monthly_allowance INT;
  v_addon_credits     INT;
  v_used_this_period  INT;
  v_total_available   INT;
  v_new_balance       INT;
BEGIN
  -- Lock the user's credit row for the duration of this transaction.
  -- Concurrent calls for the same user_id will queue here.
  SELECT
    monthly_allowance,
    addon_credits,
    used_this_period
  INTO
    v_monthly_allowance,
    v_addon_credits,
    v_used_this_period
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
  SET used_this_period = used_this_period + p_cost
  WHERE user_id = p_user_id;

  v_new_balance := v_total_available - p_cost;

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_new_balance,
    'deducted', p_cost
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION deduct_ai_credits(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION deduct_ai_credits(UUID, INT) TO authenticated;

COMMENT ON FUNCTION deduct_ai_credits(UUID, INT) IS
'Atomic credit deduction. Uses SELECT ... FOR UPDATE to serialize concurrent
deductions per user, preventing race conditions where two simultaneous
requests both pass a stale balance check and both deduct.';
