-- Calendar feed tokens: one bearer token per user, used to authenticate the
-- unauthenticated ICS feed endpoint (/api/calendar/feed/[token]). The token
-- itself IS the secret for that route (no session/cookie auth there — calendar
-- apps poll it directly), so this table is deliberately owner-only from the
-- authenticated side: only the signed-in user may see, create, or rotate
-- their own token. Server-side lookups from the feed route go through the
-- service-role admin client and bypass RLS entirely (see getSupabaseAdmin()).

CREATE TABLE IF NOT EXISTS calendar_feed_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_feed_tokens_token
  ON calendar_feed_tokens (token);

ALTER TABLE calendar_feed_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_feed_tokens_select" ON calendar_feed_tokens;
DROP POLICY IF EXISTS "calendar_feed_tokens_insert" ON calendar_feed_tokens;
DROP POLICY IF EXISTS "calendar_feed_tokens_update" ON calendar_feed_tokens;
DROP POLICY IF EXISTS "calendar_feed_tokens_delete" ON calendar_feed_tokens;

CREATE POLICY "calendar_feed_tokens_select" ON calendar_feed_tokens
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "calendar_feed_tokens_insert" ON calendar_feed_tokens
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "calendar_feed_tokens_update" ON calendar_feed_tokens
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "calendar_feed_tokens_delete" ON calendar_feed_tokens
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
