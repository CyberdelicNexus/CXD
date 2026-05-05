-- AI Credit System: Tracks per-user credit balance and model selection
CREATE TABLE IF NOT EXISTS public.ai_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_allowance INT NOT NULL DEFAULT 0,
  used_this_period INT NOT NULL DEFAULT 0,
  addon_credits INT NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  selected_model TEXT NOT NULL DEFAULT 'gpt',
  CONSTRAINT unique_user_credits UNIQUE (user_id)
);

-- Credit transaction log for audit trail
CREATE TABLE IF NOT EXISTS public.ai_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  balance_after INT NOT NULL,
  reason TEXT NOT NULL,
  model_used TEXT,
  project_id UUID,
  face_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_credits_user
  ON public.ai_credits (user_id);

CREATE INDEX IF NOT EXISTS idx_ai_credit_transactions_user
  ON public.ai_credit_transactions (user_id, created_at DESC);

-- RLS
ALTER TABLE public.ai_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credits"
  ON public.ai_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own credits"
  ON public.ai_credits FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own credits"
  ON public.ai_credits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions"
  ON public.ai_credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON public.ai_credit_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
