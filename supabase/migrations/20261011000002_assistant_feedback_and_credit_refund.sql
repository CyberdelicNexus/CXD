-- Canvas Assistant beta: (1) a refund path for AI credits, (2) a feedback log.
--
-- 1. refund_ai_credits
-- Credits are deducted BEFORE the model runs (deduct_ai_credits), so a request
-- that then fails (provider error, timeout, truncated answer) charged the user
-- for nothing. This gives the server a way to hand the charge back. It only
-- ever lowers the two usage counters, never below zero, so it cannot mint
-- credits beyond what was used. Deliberately NOT granted to `authenticated`:
-- a refund a signed-in user could call on themselves would be free credits.
-- The API routes call it with the service-role client.

CREATE OR REPLACE FUNCTION refund_ai_credits(
  p_user_id UUID,
  p_cost    INT
)
RETURNS JSONB AS $$
DECLARE
  v_today_start TIMESTAMPTZ := date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
  IF p_cost IS NULL OR p_cost <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_cost');
  END IF;

  UPDATE public.ai_credits
  SET used_this_period = GREATEST(0, used_this_period - p_cost),
      -- Only hand back today's usage if the charge was made today.
      used_today = CASE
        WHEN today_reset_at >= v_today_start THEN GREATEST(0, used_today - p_cost)
        ELSE used_today
      END
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_credits_record');
  END IF;
  RETURN jsonb_build_object('success', true, 'refunded', p_cost);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION refund_ai_credits(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION refund_ai_credits(UUID, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION refund_ai_credits(UUID, INT) TO service_role;

COMMENT ON FUNCTION refund_ai_credits(UUID, INT) IS
'Hands back an AI credit charge when the request it paid for failed. Service role only.';

-- 2. canvas_assistant_feedback
-- An append-only event log of how people use the Canvas Assistant while it is
-- in beta: which form they picked against the one suggested, whether they
-- built or discarded a proposal, what they refined, whether a build was taken
-- off the canvas again soon after (undo or delete), and how they rated the
-- result. Events for one proposal share an entry_id. `payload` holds the
-- event's details (and, for built and rated diagrams, a compact snapshot of
-- what was drawn) so real requests can be replayed in the Structure Lab.
--
-- Owner-only from the authenticated side: a user may add and read their own
-- events. Analysis reads go through the service role and bypass RLS.

CREATE TABLE IF NOT EXISTS canvas_assistant_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id text,
  entry_id text NOT NULL,
  event text NOT NULL CHECK (event IN ('form_picked', 'built', 'discarded', 'refined', 'rated', 'removed')),
  -- rated: 1 = good, -1 = not right. NULL for every other event.
  rating smallint CHECK (rating IN (-1, 1)),
  reason text,
  instruction text,
  model text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canvas_assistant_feedback_created
  ON canvas_assistant_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_canvas_assistant_feedback_entry
  ON canvas_assistant_feedback (entry_id);
CREATE INDEX IF NOT EXISTS idx_canvas_assistant_feedback_rated
  ON canvas_assistant_feedback (rating) WHERE rating IS NOT NULL;

ALTER TABLE canvas_assistant_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "canvas_assistant_feedback_select" ON canvas_assistant_feedback;
DROP POLICY IF EXISTS "canvas_assistant_feedback_insert" ON canvas_assistant_feedback;

CREATE POLICY "canvas_assistant_feedback_select" ON canvas_assistant_feedback
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "canvas_assistant_feedback_insert" ON canvas_assistant_feedback
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
