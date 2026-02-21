-- Diagnostic: Check collaborator setup and permissions
-- Run this in Supabase SQL Editor to debug collaborator issues

-- 1. Check if you have collaborator records for a specific canvas
-- Replace 'YOUR_CANVAS_ID' with the actual canvas ID
SELECT
  cc.id,
  cc.canvas_id,
  cc.user_id,
  cc.role,
  cc.added_at,
  u.email as user_email,
  p.name as canvas_name,
  p.owner_id as canvas_owner_id
FROM canvas_collaborators cc
LEFT JOIN auth.users u ON cc.user_id = u.id
LEFT JOIN cxd_projects p ON cc.canvas_id = p.id
WHERE cc.canvas_id = 'YOUR_CANVAS_ID'
ORDER BY cc.added_at DESC;

-- 2. Check all collaborator relationships for current user
-- This shows all canvases where you're a collaborator
SELECT
  cc.canvas_id,
  cc.role,
  p.name as canvas_name,
  p.owner_id,
  owner_email.email as owner_email
FROM canvas_collaborators cc
LEFT JOIN cxd_projects p ON cc.canvas_id = p.id
LEFT JOIN auth.users owner_email ON p.owner_id = owner_email.id
WHERE cc.user_id = auth.uid()
ORDER BY cc.added_at DESC;

-- 3. Check RLS policies on cxd_projects table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'cxd_projects'
ORDER BY policyname;

-- 4. Check if a specific user can update a specific canvas
-- Replace with actual IDs to test
SELECT
  p.id as canvas_id,
  p.name as canvas_name,
  p.owner_id,
  auth.uid() as current_user_id,
  (auth.uid() = p.owner_id) as is_owner,
  EXISTS (
    SELECT 1 FROM canvas_collaborators
    WHERE canvas_id = p.id AND user_id = auth.uid()
  ) as is_collaborator,
  (
    auth.uid() = p.owner_id OR
    EXISTS (
      SELECT 1 FROM canvas_collaborators
      WHERE canvas_id = p.id AND user_id = auth.uid()
    )
  ) as can_update
FROM cxd_projects p
WHERE p.id = 'YOUR_CANVAS_ID';
