-- ============================================================================
-- CXD AI Tables — Consolidated Migration
-- Run this in your Supabase Dashboard SQL Editor:
--   https://supabase.com/dashboard/project/sstllhsrmcvijyokykwp/sql
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. AI Chat Threads (base table)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.cxd_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  face_key TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_threads_lookup
  ON public.ai_chat_threads (project_id, user_id, face_key);

ALTER TABLE public.ai_chat_threads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own threads' AND tablename = 'ai_chat_threads') THEN
    CREATE POLICY "Users can view own threads"
      ON public.ai_chat_threads FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own threads' AND tablename = 'ai_chat_threads') THEN
    CREATE POLICY "Users can insert own threads"
      ON public.ai_chat_threads FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own threads' AND tablename = 'ai_chat_threads') THEN
    CREATE POLICY "Users can update own threads"
      ON public.ai_chat_threads FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own threads' AND tablename = 'ai_chat_threads') THEN
    CREATE POLICY "Users can delete own threads"
      ON public.ai_chat_threads FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Multi-session support (title, is_active, is_archived + partial unique index)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.ai_chat_threads
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Drop old unique constraint (one thread per face) — safe to run even if it doesn't exist
ALTER TABLE public.ai_chat_threads
  DROP CONSTRAINT IF EXISTS unique_thread_per_face;

-- Partial unique index: only one ACTIVE thread per project+user+face
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_threads_active_unique
  ON public.ai_chat_threads (project_id, user_id, face_key)
  WHERE is_active = true;

-- Index for listing archived threads
CREATE INDEX IF NOT EXISTS idx_ai_threads_archived
  ON public.ai_chat_threads (project_id, user_id, face_key, is_archived, updated_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Face metadata columns
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.ai_chat_threads
  ADD COLUMN IF NOT EXISTS face_label TEXT,
  ADD COLUMN IF NOT EXISTS face_hue INT;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. AI Credits table
-- ────────────────────────────────────────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_ai_credits_user
  ON public.ai_credits (user_id);

ALTER TABLE public.ai_credits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own credits' AND tablename = 'ai_credits') THEN
    CREATE POLICY "Users can view own credits"
      ON public.ai_credits FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own credits' AND tablename = 'ai_credits') THEN
    CREATE POLICY "Users can update own credits"
      ON public.ai_credits FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own credits' AND tablename = 'ai_credits') THEN
    CREATE POLICY "Users can insert own credits"
      ON public.ai_credits FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Credit Transactions (audit trail)
-- ────────────────────────────────────────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_ai_credit_transactions_user
  ON public.ai_credit_transactions (user_id, created_at DESC);

ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own transactions' AND tablename = 'ai_credit_transactions') THEN
    CREATE POLICY "Users can view own transactions"
      ON public.ai_credit_transactions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own transactions' AND tablename = 'ai_credit_transactions') THEN
    CREATE POLICY "Users can insert own transactions"
      ON public.ai_credit_transactions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Credit deduction RPC function (atomic check + deduct)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_ai_credits(p_user_id UUID, p_cost INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining INT;
BEGIN
  -- Calculate remaining credits
  SELECT (monthly_allowance + addon_credits - used_this_period)
  INTO v_remaining
  FROM public.ai_credits
  WHERE user_id = p_user_id;

  -- No credit row found — allow (credits not configured yet)
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  -- Insufficient credits
  IF v_remaining < p_cost THEN
    RAISE EXCEPTION 'insufficient credits';
  END IF;

  -- Deduct
  UPDATE public.ai_credits
  SET used_this_period = used_this_period + p_cost
  WHERE user_id = p_user_id;

  RETURN true;
END;
$$;

-- ============================================================================
-- RPC: Atomically add credits (for top-up purchases via Stripe)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_ai_credits(p_user_id UUID, p_amount INT, p_reason TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_addon INT;
BEGIN
  UPDATE public.ai_credits
  SET addon_credits = addon_credits + p_amount
  WHERE user_id = p_user_id
  RETURNING addon_credits INTO v_new_addon;

  IF NOT FOUND THEN
    INSERT INTO public.ai_credits (user_id, monthly_allowance, used_this_period, addon_credits, selected_model)
    VALUES (p_user_id, 500, 0, p_amount, 'gpt')
    RETURNING addon_credits INTO v_new_addon;
  END IF;

  INSERT INTO public.ai_credit_transactions (user_id, amount, balance_after, reason)
  VALUES (p_user_id, p_amount, v_new_addon, p_reason);

  RETURN v_new_addon;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_ai_credits TO service_role;

-- ============================================================================
-- Done! All AI tables, RLS policies, indexes, and RPC functions are ready.
-- ============================================================================
