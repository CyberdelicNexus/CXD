-- AI Credits V2: Enhanced credit tracking with per-model weights and token counting
-- Migration to support the new weighted credit system

-- Add new columns to ai_credits table
ALTER TABLE public.ai_credits
  ADD COLUMN IF NOT EXISTS input_tokens_used BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens_used BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_model_used TEXT,
  ADD COLUMN IF NOT EXISTS last_credit_refresh TIMESTAMPTZ DEFAULT NOW();

-- Add new columns to ai_credit_transactions for detailed tracking
ALTER TABLE public.ai_credit_transactions
  ADD COLUMN IF NOT EXISTS input_tokens INT,
  ADD COLUMN IF NOT EXISTS output_tokens INT,
  ADD COLUMN IF NOT EXISTS credits_consumed INT,
  ADD COLUMN IF NOT EXISTS transaction_type TEXT NOT NULL DEFAULT 'usage';

-- Update selected_model default to use new model IDs
UPDATE public.ai_credits
  SET selected_model = 'gemini-2.0-flash'
  WHERE selected_model IN ('gpt', 'claude', 'gemini');

-- Create index for faster credit refresh queries
CREATE INDEX IF NOT EXISTS idx_ai_credits_refresh
  ON public.ai_credits (period_end, last_credit_refresh);

-- Create index for transaction analytics
CREATE INDEX IF NOT EXISTS idx_ai_credit_transactions_model
  ON public.ai_credit_transactions (model_used, created_at DESC);

-- Comment updates
COMMENT ON COLUMN public.ai_credits.input_tokens_used IS 'Total input tokens consumed this period';
COMMENT ON COLUMN public.ai_credits.output_tokens_used IS 'Total output tokens consumed this period';
COMMENT ON COLUMN public.ai_credits.last_model_used IS 'Last model ID used (for analytics)';
COMMENT ON COLUMN public.ai_credits.last_credit_refresh IS 'Timestamp of last credit period reset';

COMMENT ON COLUMN public.ai_credit_transactions.input_tokens IS 'Input tokens for this transaction';
COMMENT ON COLUMN public.ai_credit_transactions.output_tokens IS 'Output tokens for this transaction';
COMMENT ON COLUMN public.ai_credit_transactions.credits_consumed IS 'Weighted credits consumed (based on model cost)';
COMMENT ON COLUMN public.ai_credit_transactions.transaction_type IS 'Type: usage, addon_purchase, monthly_reset, manual_adjustment';

-- Function to reset monthly credits (to be called by cron or manually)
CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS void AS $$
BEGIN
  UPDATE public.ai_credits
  SET
    used_this_period = 0,
    input_tokens_used = 0,
    output_tokens_used = 0,
    period_start = NOW(),
    period_end = NOW() + INTERVAL '1 month',
    last_credit_refresh = NOW()
  WHERE period_end <= NOW();

  -- Log reset transactions
  INSERT INTO public.ai_credit_transactions (user_id, amount, balance_after, reason, transaction_type)
  SELECT
    user_id,
    0,
    monthly_allowance + addon_credits,
    'Monthly credit reset',
    'monthly_reset'
  FROM public.ai_credits
  WHERE period_end <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to consume credits (called by API)
CREATE OR REPLACE FUNCTION consume_credits(
  p_user_id UUID,
  p_credits INT,
  p_model TEXT,
  p_input_tokens INT,
  p_output_tokens INT,
  p_project_id UUID DEFAULT NULL,
  p_face_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_total_available INT;
  v_new_balance INT;
BEGIN
  -- Get current balance
  SELECT (monthly_allowance + addon_credits - used_this_period) INTO v_total_available
  FROM public.ai_credits
  WHERE user_id = p_user_id;

  -- Check if user has enough credits
  IF v_total_available < p_credits THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'available', v_total_available,
      'required', p_credits
    );
  END IF;

  -- Consume credits
  UPDATE public.ai_credits
  SET
    used_this_period = used_this_period + p_credits,
    input_tokens_used = input_tokens_used + p_input_tokens,
    output_tokens_used = output_tokens_used + p_output_tokens,
    last_model_used = p_model
  WHERE user_id = p_user_id;

  -- Calculate new balance
  v_new_balance := v_total_available - p_credits;

  -- Log transaction
  INSERT INTO public.ai_credit_transactions (
    user_id,
    amount,
    balance_after,
    reason,
    model_used,
    input_tokens,
    output_tokens,
    credits_consumed,
    project_id,
    face_key,
    transaction_type
  ) VALUES (
    p_user_id,
    -p_credits,
    v_new_balance,
    'AI model usage',
    p_model,
    p_input_tokens,
    p_output_tokens,
    p_credits,
    p_project_id,
    p_face_key,
    'usage'
  );

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_new_balance,
    'consumed', p_credits
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION reset_monthly_credits() TO service_role;
GRANT EXECUTE ON FUNCTION consume_credits(UUID, INT, TEXT, INT, INT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION consume_credits(UUID, INT, TEXT, INT, INT, UUID, TEXT) TO authenticated;
