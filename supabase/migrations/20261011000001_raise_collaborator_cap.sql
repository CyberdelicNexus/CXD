-- Raise the paid-plan collaborator cap from 3 to 5 (matches src/lib/plans.ts).
-- Only the hardcoded limit changes; the rest of the function is unchanged from
-- 20240106000001_collaboration_schema.sql.

CREATE OR REPLACE FUNCTION public.can_add_collaborator(p_canvas_id UUID)
RETURNS TABLE(allowed BOOLEAN, reason TEXT) AS $$
DECLARE
  v_owner_id UUID;
  v_plan_id TEXT;
  v_max_collaborators INT;
  v_current_count INT;
BEGIN
  -- Get canvas owner
  SELECT owner_id INTO v_owner_id
  FROM public.cxd_projects
  WHERE id = p_canvas_id;

  IF v_owner_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Canvas not found'::TEXT;
    RETURN;
  END IF;

  -- Get owner's plan
  SELECT plan_id::TEXT INTO v_plan_id
  FROM public.subscriptions
  WHERE user_id = v_owner_id;

  v_plan_id := COALESCE(v_plan_id, 'free');

  -- Check plan limits (hardcoded for now, match plans.ts)
  IF v_plan_id = 'free' THEN
    RETURN QUERY SELECT FALSE, 'Upgrade to Pro to invite collaborators'::TEXT;
    RETURN;
  ELSIF v_plan_id IN ('pro', 'lifetime', 'beta_tester') THEN
    v_max_collaborators := 5;
  ELSE
    v_max_collaborators := 0;
  END IF;

  -- Count current collaborators (excluding owner)
  SELECT COUNT(*) INTO v_current_count
  FROM public.canvas_collaborators
  WHERE canvas_id = p_canvas_id AND role != 'owner';

  IF v_current_count >= v_max_collaborators THEN
    RETURN QUERY SELECT FALSE, format('Maximum %s collaborators reached', v_max_collaborators)::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
