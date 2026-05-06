-- Auto-set free_primary_canvas_id for new free users on their first canvas.
--
-- Bug being fixed: a brand-new free user creates their first canvas, but
-- canvas-permissions.ts treats it as locked because free_primary_canvas_id
-- has never been set (the field exists for the Pro→Free downgrade flow,
-- where users with multiple canvases must pick which one stays editable —
-- it shouldn't apply to first-canvas-ever creation).
--
-- Fix has two pieces:
--   1. Trigger: when a free user inserts their first canvas, auto-set their
--      subscriptions.free_primary_canvas_id to point at it. Idempotent —
--      only acts when free_primary_canvas_id IS NULL.
--   2. One-time backfill: any existing free user without a primary gets
--      their oldest canvas set as the primary. Fixes test accounts
--      already in the broken state.

-- ============================================================================
-- Part 1: trigger for future inserts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_set_free_primary_canvas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act for users on the free plan with no primary yet.
  UPDATE public.subscriptions
     SET free_primary_canvas_id = NEW.id
   WHERE user_id = NEW.owner_id
     AND plan_id = 'free'
     AND free_primary_canvas_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_set_free_primary_canvas_trigger ON public.cxd_projects;
CREATE TRIGGER auto_set_free_primary_canvas_trigger
  AFTER INSERT ON public.cxd_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_free_primary_canvas();

-- ============================================================================
-- Part 2: one-time backfill for users already in the broken state
-- ============================================================================

UPDATE public.subscriptions s
   SET free_primary_canvas_id = oldest.id
  FROM (
    SELECT DISTINCT ON (owner_id) owner_id, id
    FROM public.cxd_projects
    ORDER BY owner_id, created_at ASC
  ) AS oldest
 WHERE s.user_id = oldest.owner_id
   AND s.plan_id = 'free'
   AND s.free_primary_canvas_id IS NULL;
