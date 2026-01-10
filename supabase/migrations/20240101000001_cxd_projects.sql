-- CXD Projects table for storing user projects

CREATE TABLE IF NOT EXISTS public.cxd_projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL,
    name text NOT NULL,
    description text DEFAULT '',
    project_data jsonb NOT NULL DEFAULT '{}',
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS cxd_projects_owner_id_idx ON public.cxd_projects(owner_id);

ALTER TABLE public.cxd_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own projects" ON public.cxd_projects;
CREATE POLICY "Users can view own projects" ON public.cxd_projects
    FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert own projects" ON public.cxd_projects;
CREATE POLICY "Users can insert own projects" ON public.cxd_projects
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own projects" ON public.cxd_projects;
CREATE POLICY "Users can update own projects" ON public.cxd_projects
    FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete own projects" ON public.cxd_projects;
CREATE POLICY "Users can delete own projects" ON public.cxd_projects
    FOR DELETE USING (auth.uid() = owner_id);
