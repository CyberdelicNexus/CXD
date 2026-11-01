-- Admin console access (spec 2026-10-31-admin-console-design).
--
-- staff_roles decides who can reach /admin. Nothing reads an email address, so
-- registering or changing to one grants nothing. Owner rows exist only through
-- migrations: the trigger refuses every other write, so a route bug cannot
-- remove the Owner. service_role can read this table but never write it; all
-- writes go through admin_set_role.

CREATE TABLE IF NOT EXISTS public.staff_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'staff')),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.staff_roles_protect_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_setting('cxd.allow_owner_change', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP <> 'INSERT' AND OLD.role = 'owner' THEN
    RAISE EXCEPTION 'owner_protected';
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.role = 'owner' THEN
    RAISE EXCEPTION 'owner_protected';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS staff_roles_protect_owner ON public.staff_roles;
CREATE TRIGGER staff_roles_protect_owner
  BEFORE INSERT OR UPDATE OR DELETE ON public.staff_roles
  FOR EACH ROW EXECUTE FUNCTION public.staff_roles_protect_owner();

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  before jsonb,
  after jsonb,
  reason text,
  outcome text NOT NULL CHECK (outcome IN ('attempted', 'succeeded', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON public.admin_audit_log (target_type, target_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_audit_log_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log_is_append_only';
END;
$$;

DROP TRIGGER IF EXISTS admin_audit_log_append_only ON public.admin_audit_log;
CREATE TRIGGER admin_audit_log_append_only
  BEFORE UPDATE OR DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.admin_audit_log_append_only();

DROP TRIGGER IF EXISTS admin_audit_log_no_truncate ON public.admin_audit_log;
CREATE TRIGGER admin_audit_log_no_truncate
  BEFORE TRUNCATE ON public.admin_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.admin_audit_log_append_only();

ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.staff_roles FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.admin_audit_log FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.staff_roles TO service_role;
GRANT SELECT, INSERT ON public.admin_audit_log TO service_role;

-- Refuses unless p_actor holds one of p_roles. Routes gate first; this is the
-- second check, so a route bug cannot act for someone without the role.
CREATE OR REPLACE FUNCTION public.admin_require_role(p_actor uuid, p_roles text[])
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_roles WHERE user_id = p_actor AND role = ANY (p_roles)
  ) THEN
    RAISE EXCEPTION 'not_permitted';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_role(
  p_actor uuid,
  p_target uuid,
  p_role text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_before text;
BEGIN
  PERFORM public.admin_require_role(p_actor, ARRAY['owner']);

  IF p_role IS NOT NULL AND p_role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;

  SELECT role INTO v_before FROM public.staff_roles WHERE user_id = p_target;

  IF p_role IS NULL THEN
    DELETE FROM public.staff_roles WHERE user_id = p_target;
  ELSE
    INSERT INTO public.staff_roles (user_id, role, granted_by)
    VALUES (p_target, p_role, p_actor)
    ON CONFLICT (user_id) DO UPDATE
      SET role = EXCLUDED.role, granted_by = EXCLUDED.granted_by, granted_at = now();
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, before, after, reason, outcome)
  VALUES (
    p_actor, 'role.set', 'user', p_target::text,
    jsonb_build_object('role', v_before), jsonb_build_object('role', p_role),
    p_reason, 'succeeded'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_require_role(uuid, text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_role(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_require_role(uuid, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, uuid, text, text) TO service_role;

-- Launch Owner: connect@cyberdelic.nexus. Add an Owner with a new migration in
-- this same form, after that account exists.
DO $$
BEGIN
  PERFORM set_config('cxd.allow_owner_change', 'on', true);
  INSERT INTO public.staff_roles (user_id, role)
  SELECT id, 'owner' FROM auth.users WHERE id = '322d15dd-8477-41ff-8980-f344fda14164'
  ON CONFLICT (user_id) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.staff_roles WHERE role = 'owner') THEN
    RAISE EXCEPTION 'owner_not_seeded';
  END IF;
END $$;
