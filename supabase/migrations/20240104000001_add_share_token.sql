-- Add share_token column to cxd_projects for public sharing

ALTER TABLE public.cxd_projects 
ADD COLUMN IF NOT EXISTS share_token text UNIQUE;

CREATE INDEX IF NOT EXISTS cxd_projects_share_token_idx ON public.cxd_projects(share_token);

DROP POLICY IF EXISTS "Anyone can view shared projects" ON public.cxd_projects;
CREATE POLICY "Anyone can view shared projects" ON public.cxd_projects
    FOR SELECT USING (share_token IS NOT NULL AND share_token != '');
