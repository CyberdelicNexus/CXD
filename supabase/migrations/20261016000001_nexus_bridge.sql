-- Nexus <-> CXD Canvas bridge (platform decision D182).
--
-- The Cyberdelic Nexus platform signs a 60-second ES256 handoff token; the
-- Canvas verifies it at POST /auth/nexus-callback and signs the member in.
-- These tables are written ONLY by the service-role client from server routes:
-- RLS is on with no policies, and anon/authenticated have no privileges, so
-- nothing here is reachable from the browser.

-- One Canvas user per Nexus member, and one member per Canvas user.
CREATE TABLE IF NOT EXISTS public.nexus_links (
  member_id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now()
);

-- Single-use handoff tokens: a jti is inserted once; a second insert conflicts
-- and the replay is refused. Rows past expires_at are purged opportunistically.
CREATE TABLE IF NOT EXISTS public.nexus_handoff_jti (
  jti text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nexus_handoff_jti_expires
  ON public.nexus_handoff_jti (expires_at);

-- A member whose Canvas email is not confirmed proves control of that account
-- by signing in once. The browser holds a random 128-bit token in the
-- httpOnly cookie cxd_nexus_link; only its sha256 is stored here.
CREATE TABLE IF NOT EXISTS public.nexus_pending_links (
  token_hash text PRIMARY KEY,
  member_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  intent jsonb,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nexus_pending_links_expires
  ON public.nexus_pending_links (expires_at);

ALTER TABLE public.nexus_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexus_handoff_jti ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nexus_pending_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.nexus_links FROM anon, authenticated;
REVOKE ALL ON public.nexus_handoff_jti FROM anon, authenticated;
REVOKE ALL ON public.nexus_pending_links FROM anon, authenticated;

GRANT ALL ON public.nexus_links TO service_role;
GRANT ALL ON public.nexus_handoff_jti TO service_role;
GRANT ALL ON public.nexus_pending_links TO service_role;

-- Where the plan came from, so the Nexus tier sync only ever downgrades a plan
-- it granted itself, and a Stripe cancellation never downgrades a Nexus plan.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_source text NULL,
  ADD COLUMN IF NOT EXISTS nexus_checked_at timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'subscriptions_plan_source_check'
       AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_plan_source_check
      CHECK (plan_source IN ('stripe', 'nexus'));
  END IF;
END $$;

-- Look up a Canvas auth user by email (case-insensitive). Service role only.
CREATE OR REPLACE FUNCTION public.nexus_find_auth_user(p_email text)
RETURNS TABLE (id uuid, email_confirmed_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id, u.email_confirmed_at
    FROM auth.users u
   WHERE lower(u.email) = lower(p_email)
   ORDER BY u.created_at ASC
   LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.nexus_find_auth_user(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nexus_find_auth_user(text) TO service_role;
