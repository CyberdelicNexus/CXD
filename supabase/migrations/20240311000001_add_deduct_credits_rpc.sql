-- Add simplified deduct_ai_credits RPC for chat/analyze routes
-- This is a simpler version that just checks and deducts credits without token tracking
-- Token tracking happens separately in consume_credits

-- Drop existing function if it exists (with any signature)
DROP FUNCTION IF EXISTS deduct_ai_credits(UUID, INT);

CREATE OR REPLACE FUNCTION deduct_ai_credits(
  p_user_id UUID,
  p_cost INT
)
RETURNS JSONB AS $$
DECLARE
  v_monthly_allowance INT;
  v_addon_credits INT;
  v_used_this_period INT;
  v_total_available INT;
  v_new_balance INT;
BEGIN
  -- Get current credit state
  SELECT
    monthly_allowance,
    addon_credits,
    used_this_period
  INTO
    v_monthly_allowance,
    v_addon_credits,
    v_used_this_period
  FROM public.ai_credits
  WHERE user_id = p_user_id;

  -- If no record found, return error
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_credits_record',
      'message', 'Credit record not found for user'
    );
  END IF;

  -- Calculate total available credits
  v_total_available := (v_monthly_allowance + v_addon_credits) - v_used_this_period;

  -- Check if user has enough credits
  IF v_total_available < p_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'available', v_total_available,
      'required', p_cost
    );
  END IF;

  -- Deduct credits by incrementing used_this_period
  UPDATE public.ai_credits
  SET used_this_period = used_this_period + p_cost
  WHERE user_id = p_user_id;

  -- Calculate new balance
  v_new_balance := v_total_available - p_cost;

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_new_balance,
    'deducted', p_cost
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION deduct_ai_credits(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION deduct_ai_credits(UUID, INT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION deduct_ai_credits(UUID, INT) IS
'Simplified credit deduction for chat/analyze routes.
Checks available credits and increments used_this_period if sufficient.
Returns success status, new balance, or error if insufficient.';
