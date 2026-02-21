-- Fix collaborator update policy
-- Ensures collaborators can update projects they have access to

-- Drop and recreate the update policy to ensure it's correctly applied
DROP POLICY IF EXISTS "Users can update owned and collaborated projects" ON public.cxd_projects;

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

-- Verify grant permissions
GRANT UPDATE ON public.cxd_projects TO authenticated;
