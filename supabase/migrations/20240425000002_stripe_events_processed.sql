-- Stripe webhook event idempotency.
-- Stripe retries on any 5xx (and on its own delivery failures) with exponential
-- backoff for up to 72h. Without dedupe, retries cause duplicate subscription
-- updates, double credit grants, multiple emails, etc.
--
-- The pattern: webhook handler INSERTs `event.id` into this table immediately
-- after signature verification. If the unique constraint fires (23505), the
-- event was already processed — return 200 without touching anything else.

CREATE TABLE IF NOT EXISTS stripe_events_processed (
  event_id     text        PRIMARY KEY,
  event_type   text        NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_at
  ON stripe_events_processed (processed_at DESC);

-- Service role only writes here (called from webhook handler with admin client).
-- No public read/write needed; locking out RLS policies entirely.
ALTER TABLE stripe_events_processed ENABLE ROW LEVEL SECURITY;
-- (No policies = nothing visible to anon/authenticated; service role bypasses RLS.)
