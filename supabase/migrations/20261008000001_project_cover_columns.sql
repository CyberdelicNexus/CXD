-- Cover image/position as real columns so the dashboard listing never has to
-- detoast the multi-MB project_data JSONB just to read one string.
-- Additive and nullable: old code keeps working; project_data keeps its copy.

alter table public.cxd_projects
  add column if not exists cover_image text,
  add column if not exists cover_position jsonb;

update public.cxd_projects
set cover_image = nullif(project_data->>'coverImage', ''),
    cover_position = project_data->'coverPosition'
where cover_image is null
  and coalesce(project_data->>'coverImage', '') <> '';
