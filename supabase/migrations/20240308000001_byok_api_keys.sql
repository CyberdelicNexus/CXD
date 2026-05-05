-- BYOK (Bring Your Own Keys) - Encrypted API key storage for Lifetime users
-- Keys are encrypted server-side before storage for security

CREATE TABLE IF NOT EXISTS public.user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai', 'google', 'moonshot')),
  encrypted_key TEXT NOT NULL,
  key_name TEXT,  -- Optional user-friendly name
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One active key per provider per user
  CONSTRAINT unique_user_provider UNIQUE (user_id, provider)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user
  ON public.user_api_keys (user_id);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_provider
  ON public.user_api_keys (user_id, provider, is_active);

-- RLS Policies
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API keys"
  ON public.user_api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API keys"
  ON public.user_api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys"
  ON public.user_api_keys FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys"
  ON public.user_api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_api_keys_updated_at
  BEFORE UPDATE ON public.user_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_user_api_keys_updated_at();

-- Function to update last_used_at (called when key is used)
CREATE OR REPLACE FUNCTION mark_api_key_used(p_user_id UUID, p_provider TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.user_api_keys
  SET last_used_at = NOW()
  WHERE user_id = p_user_id AND provider = p_provider;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_api_key_used(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_api_key_used(UUID, TEXT) TO service_role;

-- Comments
COMMENT ON TABLE public.user_api_keys IS 'Stores encrypted API keys for BYOK (Lifetime users only)';
COMMENT ON COLUMN public.user_api_keys.encrypted_key IS 'API key encrypted using AES-256-GCM';
COMMENT ON COLUMN public.user_api_keys.is_active IS 'Whether this key should be used (allows disabling without deleting)';
COMMENT ON COLUMN public.user_api_keys.last_used_at IS 'Timestamp of last usage for analytics';
