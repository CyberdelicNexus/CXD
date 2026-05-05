-- Collaboration Schema Migration
-- Enables multi-user collaborative editing of canvases

-- =============================================================================
-- 1. CANVAS COLLABORATORS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.canvas_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES public.cxd_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'collaborator')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by UUID REFERENCES auth.users(id),

  -- Prevent duplicate entries
  CONSTRAINT unique_canvas_user UNIQUE (canvas_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_collaborators_canvas ON public.canvas_collaborators(canvas_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_user ON public.canvas_collaborators(user_id);

-- =============================================================================
-- 2. CANVAS INVITATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.canvas_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES public.cxd_projects(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invitations_canvas ON public.canvas_invitations(canvas_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.canvas_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.canvas_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.canvas_invitations(status);

-- =============================================================================
-- 3. MIGRATE EXISTING OWNERS TO COLLABORATORS TABLE
-- =============================================================================

INSERT INTO public.canvas_collaborators (canvas_id, user_id, role, added_at)
SELECT id, owner_id, 'owner', created_at
FROM public.cxd_projects
WHERE owner_id IS NOT NULL
ON CONFLICT (canvas_id, user_id) DO NOTHING;

-- =============================================================================
-- 4. ENABLE RLS ON NEW TABLES
-- =============================================================================

ALTER TABLE public.canvas_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_invitations ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. UPDATE CXD_PROJECTS RLS POLICIES
-- =============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own projects" ON public.cxd_projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON public.cxd_projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.cxd_projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.cxd_projects;
DROP POLICY IF EXISTS "Anyone can view shared projects" ON public.cxd_projects;

-- New SELECT policy: owner, collaborators, or shared via token
CREATE POLICY "Users can view owned and collaborated projects" ON public.cxd_projects
  FOR SELECT USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.canvas_collaborators
      WHERE canvas_collaborators.canvas_id = cxd_projects.id
      AND canvas_collaborators.user_id = auth.uid()
    )
    OR (share_token IS NOT NULL AND share_token != '')
  );

-- INSERT policy: only owner can create
CREATE POLICY "Users can insert own projects" ON public.cxd_projects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- UPDATE policy: owner or collaborator can edit
CREATE POLICY "Users can update owned and collaborated projects" ON public.cxd_projects
  FOR UPDATE USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.canvas_collaborators
      WHERE canvas_collaborators.canvas_id = cxd_projects.id
      AND canvas_collaborators.user_id = auth.uid()
    )
  );

-- DELETE policy: only owner can delete
CREATE POLICY "Only owners can delete projects" ON public.cxd_projects
  FOR DELETE USING (auth.uid() = owner_id);

-- =============================================================================
-- 6. CANVAS_COLLABORATORS RLS POLICIES
-- =============================================================================

-- Anyone in a canvas can see other collaborators
CREATE POLICY "Collaborators can view other collaborators" ON public.canvas_collaborators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.canvas_collaborators cc
      WHERE cc.canvas_id = canvas_collaborators.canvas_id
      AND cc.user_id = auth.uid()
    )
  );

-- Only canvas owner can add/remove collaborators
CREATE POLICY "Owners can insert collaborators" ON public.canvas_collaborators
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cxd_projects p
      WHERE p.id = canvas_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete collaborators" ON public.canvas_collaborators
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.cxd_projects p
      WHERE p.id = canvas_id AND p.owner_id = auth.uid()
    )
    OR user_id = auth.uid() -- Users can remove themselves
  );

-- =============================================================================
-- 7. CANVAS_INVITATIONS RLS POLICIES
-- =============================================================================

-- Owners can see all invitations for their canvases
CREATE POLICY "Owners can view invitations" ON public.canvas_invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cxd_projects p
      WHERE p.id = canvas_id AND p.owner_id = auth.uid()
    )
  );

-- Users can see pending invitations addressed to them
CREATE POLICY "Users can view their pending invitations" ON public.canvas_invitations
  FOR SELECT USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND status = 'pending'
    AND expires_at > NOW()
  );

-- Only owners can create invitations
CREATE POLICY "Owners can insert invitations" ON public.canvas_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cxd_projects p
      WHERE p.id = canvas_id AND p.owner_id = auth.uid()
    )
  );

-- Owners can update invitations (revoke)
CREATE POLICY "Owners can update invitations" ON public.canvas_invitations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.cxd_projects p
      WHERE p.id = canvas_id AND p.owner_id = auth.uid()
    )
  );

-- Service role can update invitations (for accepting via API)
CREATE POLICY "Service role can manage invitations" ON public.canvas_invitations
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- 8. HELPER FUNCTION: Get user's role in a canvas
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_canvas_role(p_canvas_id UUID, p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
  v_owner_id UUID;
  v_share_token TEXT;
BEGIN
  -- Check if user is owner
  SELECT owner_id, share_token INTO v_owner_id, v_share_token
  FROM public.cxd_projects
  WHERE id = p_canvas_id;

  IF v_owner_id = p_user_id THEN
    RETURN 'owner';
  END IF;

  -- Check if user is collaborator
  SELECT role INTO v_role
  FROM public.canvas_collaborators
  WHERE canvas_id = p_canvas_id AND user_id = p_user_id;

  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;

  -- Check if canvas has share token (viewer access)
  IF v_share_token IS NOT NULL AND v_share_token != '' THEN
    RETURN 'viewer';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 9. HELPER FUNCTION: Check if user can add collaborator
-- =============================================================================

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
    v_max_collaborators := 3;
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

-- =============================================================================
-- 10. GRANT PERMISSIONS
-- =============================================================================

GRANT SELECT ON public.canvas_collaborators TO authenticated;
GRANT INSERT, DELETE ON public.canvas_collaborators TO authenticated;
GRANT ALL ON public.canvas_collaborators TO service_role;

GRANT SELECT ON public.canvas_invitations TO authenticated;
GRANT INSERT, UPDATE ON public.canvas_invitations TO authenticated;
GRANT ALL ON public.canvas_invitations TO service_role;
