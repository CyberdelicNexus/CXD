# Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a role-gated `/admin` console for managing users, support cards, errors, and in-app and email communications.

**Architecture:** Roles live in a service-role-only `staff_roles` table and are checked on the server by a shared gate on every page and API route. Sensitive database changes go through `SECURITY DEFINER` RPCs that write the change and its audit row in one transaction. Pure decision logic lives in `src/lib/admin/` so `__verify__` scripts can test it without a request.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres, Auth), zod 4, Inngest 4, Resend 6, react-email, Tailwind, Radix/shadcn.

**Spec:** `docs/superpowers/specs/2026-10-31-admin-console-design.md`

---

## Ground rules

- Work only in the worktree `C:\Users\JEMA\Documents\ClaudeCode\CXD\CXD-admin`, branch `feat/admin-console`.
- Commit as the owner with no trailers: `git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "..."`. Never add `Co-Authored-By`; it blocks Vercel Hobby deploys.
- The repo has no test runner. Tests are `*.verify.ts` scripts run with `npx tsx <path>`, using the local `check()` helper shown below. `npm run build` is the real gate.
- `docs/superpowers/` is gitignored but tracked by convention, so plan and spec edits use `git add -f`.
- **Never apply a migration, deploy an edge function, set an env var, or send a real broadcast while executing this plan.** Migrations are written and committed only. Task 27 lists what the owner must approve.
- Project ref for any read-only live check is `sstllhsrmcvijyokykwp`. The local `mcp__supabase__*` tools point at a different project (Nexus Core), so use `mcp__claude_ai_Supabase__*`.
- Import server clients from `@/supabase/server` and `@/supabase/admin`, never root `supabase/server.ts`.

## File map

```
supabase/migrations/
  20261031000001_admin_access.sql      staff_roles, audit log, owner seed, set_role
  20261031000002_admin_users.sql       plan_source 'admin', set_plan, adjust_credits, list_users
  20261031000003_support_tickets.sql   tickets and events
  20261031000004_admin_comms.sql       email_preferences, broadcasts, recipients
src/lib/admin/
  permissions.ts   pure: roles, matrix, gate decision, suspend rule
  gate.ts          server: getStaffContext, requirePermission, requirePagePermission
  audit.ts         server: writeAudit, withAudit
  http.ts          server: parseBody, rpcError
  client.ts        browser: adminPost
  plan-guard.ts    pure: planEditBlock
  users.ts         server: list and detail reads
  tickets.ts       pure: ticket types, title and body helpers
  support.ts       server: ticket reads
  comms.ts         pure: audience schema, recipient filter, content token
  broadcast.ts     server: recipients, config checks, unsubscribe links
  __verify__/      verify scripts
src/lib/email-unsubscribe.ts           pure: signed tokens
src/app/admin/                         pages
src/app/api/admin/                     gated routes
src/app/api/me/staff-role/route.ts     own role, for the nav link
src/app/api/email/unsubscribe/route.ts unsubscribe POST
src/app/unsubscribe/page.tsx           unsubscribe confirmation
src/components/admin/                  admin UI
src/components/ui/table.tsx            table primitive
src/app/auth/recovery/                 admin-sent password reset landing
emails/support-reply.tsx, emails/broadcast.tsx, emails/password-reset.tsx
```

---

## Task 0: Prepare the worktree

- [ ] **Step 1: Install dependencies**

```bash
cd "C:/Users/JEMA/Documents/ClaudeCode/CXD/CXD-admin" && npm ci
```

Expected: exits 0.

- [ ] **Step 2: Copy env for local builds**

```bash
cp ../CXD/.env.local .env.local
```

`.env.local` is gitignored. Do not print its contents.

- [ ] **Step 3: Baseline build**

Run: `npm run build`
Expected: succeeds. If it fails here, stop and report it, because the failure predates this work.

---

# Phase 1: Access

## Task 1: Permission matrix

**Files:**
- Create: `src/lib/admin/permissions.ts`
- Test: `src/lib/admin/__verify__/admin-roles.verify.ts`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * Permission matrix and gate decisions for the admin console.
 * Run: npx tsx src/lib/admin/__verify__/admin-roles.verify.ts
 */
import { PERMISSIONS, can, gateStatus, canSuspend, isBanned, isStaffRole, type Permission, type StaffRole } from '../permissions';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗', name); }
}

const EXPECTED: Record<StaffRole, Permission[]> = {
  staff: ['users.view', 'tickets.work', 'errors.view'],
  admin: ['users.view', 'tickets.work', 'errors.view', 'users.edit', 'comms.send', 'audit.view'],
  owner: [...PERMISSIONS],
};

for (const role of Object.keys(EXPECTED) as StaffRole[]) {
  for (const permission of PERMISSIONS) {
    const expected = EXPECTED[role].includes(permission);
    check(`${role} ${expected ? 'has' : 'lacks'} ${permission}`, can(role, permission) === expected);
  }
}
check('no role has nothing', PERMISSIONS.every((p) => !can(null, p)));

check('signed out is 401', gateStatus(false, null, 'users.view') === 401);
check('member is 403', gateStatus(true, null, 'users.view') === 403);
check('failed lookup denies', gateStatus(true, undefined, 'users.view') === 403);
check('staff denied edit', gateStatus(true, 'staff', 'users.edit') === 403);
check('admin denied roles', gateStatus(true, 'admin', 'roles.assign') === 403);
check('owner allowed roles', gateStatus(true, 'owner', 'roles.assign') === 200);

check('unknown role rejected', !isStaffRole('superuser'));
check('known role accepted', isStaffRole('staff'));

const base = { actorId: 'a', actorRole: 'admin' as StaffRole, targetId: 'b', targetRole: null };
check('admin suspends member', canSuspend(base) === null);
check('cannot suspend self', canSuspend({ ...base, targetId: 'a' }) === 'self');
check('cannot suspend owner', canSuspend({ ...base, actorRole: 'owner', targetRole: 'owner' }) === 'owner');
check('admin cannot suspend staff', canSuspend({ ...base, targetRole: 'staff' }) === 'role_holder');
check('owner can suspend admin', canSuspend({ ...base, actorRole: 'owner', targetRole: 'admin' }) === null);

const now = new Date('2026-11-01T00:00:00Z');
check('future ban is banned', isBanned('2030-01-01T00:00:00Z', now));
check('past ban is not', !isBanned('2020-01-01T00:00:00Z', now));
check('no ban is not', !isBanned(null, now));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx tsx src/lib/admin/__verify__/admin-roles.verify.ts`
Expected: FAIL, cannot find module `../permissions`.

- [ ] **Step 3: Implement**

```ts
/**
 * Admin roles and permissions. Pure, so it can be verified without a request.
 * Code checks permissions, never role names.
 */

export const ROLES = ['staff', 'admin', 'owner'] as const;
export type StaffRole = (typeof ROLES)[number];

/** Roles the app may grant. Owner rows are migration-only. */
export const ASSIGNABLE_ROLES = ['staff', 'admin'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const PERMISSIONS = [
  'users.view',
  'tickets.work',
  'errors.view',
  'users.edit',
  'comms.send',
  'audit.view',
  'roles.assign',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALLOWED: Record<Permission, readonly StaffRole[]> = {
  'users.view': ['staff', 'admin', 'owner'],
  'tickets.work': ['staff', 'admin', 'owner'],
  'errors.view': ['staff', 'admin', 'owner'],
  'users.edit': ['admin', 'owner'],
  'comms.send': ['admin', 'owner'],
  'audit.view': ['admin', 'owner'],
  'roles.assign': ['owner'],
};

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function can(role: StaffRole | null | undefined, permission: Permission): boolean {
  return !!role && ALLOWED[permission].includes(role);
}

export function gateStatus(
  signedIn: boolean,
  role: StaffRole | null | undefined,
  permission: Permission,
): 200 | 401 | 403 {
  if (!signedIn) return 401;
  return can(role, permission) ? 200 : 403;
}

export function isBanned(bannedUntil: string | null | undefined, now: Date): boolean {
  if (!bannedUntil) return false;
  const t = Date.parse(bannedUntil);
  return Number.isFinite(t) && t > now.getTime();
}

export type SuspendBlock = 'self' | 'owner' | 'role_holder';

/** Returns why this suspension is refused, or null when it is allowed. */
export function canSuspend(input: {
  actorId: string;
  actorRole: StaffRole;
  targetId: string;
  targetRole: StaffRole | null;
}): SuspendBlock | null {
  if (input.actorId === input.targetId) return 'self';
  if (input.targetRole === 'owner') return 'owner';
  if (input.targetRole && input.actorRole !== 'owner') return 'role_holder';
  return null;
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx tsx src/lib/admin/__verify__/admin-roles.verify.ts`
Expected: all pass, `0 failed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(admin): add role and permission matrix"
```

## Task 2: Access migration

**Files:**
- Create: `supabase/migrations/20261031000001_admin_access.sql`

- [ ] **Step 1: Write the migration**

```sql
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
BEGIN;
SELECT set_config('cxd.allow_owner_change', 'on', true);
INSERT INTO public.staff_roles (user_id, role)
SELECT id, 'owner' FROM auth.users WHERE id = '322d15dd-8477-41ff-8980-f344fda14164'
ON CONFLICT (user_id) DO NOTHING;
COMMIT;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20261031000001_admin_access.sql
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(admin): add staff roles and audit log migration"
```

## Task 3: Server gate and audit helpers

**Files:**
- Create: `src/lib/admin/gate.ts`, `src/lib/admin/audit.ts`, `src/lib/admin/http.ts`, `src/lib/admin/client.ts`

- [ ] **Step 1: Write `gate.ts`**

```ts
import { notFound } from 'next/navigation';
import { NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';
import { getSupabaseAdmin } from '@/supabase/admin';
import { can, gateStatus, isBanned, isStaffRole, type Permission, type StaffRole } from './permissions';

export interface StaffContext {
  userId: string;
  email: string;
  role: StaffRole;
}

async function resolveSession(): Promise<{ signedIn: boolean; context: StaffContext | null }> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { signedIn: false, context: null };
  if (isBanned((user as { banned_until?: string | null }).banned_until, new Date())) {
    return { signedIn: true, context: null };
  }

  const { data, error: roleError } = await getSupabaseAdmin()
    .from('staff_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  // A failed lookup denies, and so does a missing table before the migration.
  if (roleError || !isStaffRole(data?.role)) return { signedIn: true, context: null };
  return { signedIn: true, context: { userId: user.id, email: user.email ?? '', role: data.role } };
}

export async function getStaffContext(): Promise<StaffContext | null> {
  return (await resolveSession()).context;
}

export type GateResult =
  | { ok: true; staff: StaffContext }
  | { ok: false; response: NextResponse };

/** First call in every /api/admin handler. /api is outside the middleware matcher. */
export async function requirePermission(permission: Permission): Promise<GateResult> {
  const { signedIn, context } = await resolveSession();
  const status = gateStatus(signedIn, context?.role, permission);
  if (status === 200 && context) return { ok: true, staff: context };
  return {
    ok: false,
    response: NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: status === 401 ? 401 : 403 }),
  };
}

/** Pages 404 for everyone without access, so /admin does not reveal itself. */
export async function requirePagePermission(permission: Permission): Promise<StaffContext> {
  const context = await getStaffContext();
  if (!context || !can(context.role, permission)) notFound();
  return context;
}
```

- [ ] **Step 2: Write `audit.ts`**

```ts
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/supabase/admin';

export interface AuditEntry {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

async function insertAudit(entry: AuditEntry, outcome: 'attempted' | 'succeeded' | 'failed') {
  const { error } = await getSupabaseAdmin().from('admin_audit_log').insert({
    actor_id: entry.actorId,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    reason: entry.reason ?? null,
    outcome,
  });
  if (error) throw new Error(`audit write failed: ${error.message}`);
}

/**
 * For actions that call outside services. The attempt is recorded first, and a
 * failed attempt write aborts the action. Actions inside the database use RPCs,
 * which audit in their own transaction.
 */
export async function withAudit<T>(entry: AuditEntry, action: () => Promise<T>): Promise<T> {
  await insertAudit(entry, 'attempted');
  let result: T;
  try {
    result = await action();
  } catch (err) {
    await insertAudit(entry, 'failed').catch((e) => Sentry.captureException(e));
    throw err;
  }
  await insertAudit(entry, 'succeeded').catch((e) => Sentry.captureException(e));
  return result;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  await insertAudit(entry, 'succeeded');
}
```

- [ ] **Step 3: Write `http.ts`**

```ts
import { NextResponse } from 'next/server';
import type { z } from 'zod';

export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, response: NextResponse.json({ error: 'Invalid request' }, { status: 400 }) };
}

const RPC_MESSAGES: Record<string, string> = {
  not_permitted: 'You do not have permission to do that.',
  owner_protected: 'Owner accounts cannot be changed here.',
  invalid_role: 'That role is not valid.',
  no_subscription: 'This user has no subscription record.',
  no_change: 'The user is already on that plan.',
  stripe_managed: 'This plan is managed by Stripe.',
  nexus_managed: 'This plan is managed by Cyberdelic Nexus.',
  lifetime_plan: 'Lifetime plans cannot be changed here.',
  invalid_plan: 'That plan is not valid.',
  no_credit_record: 'This user has no credit record.',
  negative_balance: 'That would take the balance below zero.',
};

/** Maps a RAISE EXCEPTION code from an admin RPC to a readable 409. */
export function rpcError(error: { message?: string }): NextResponse {
  const message = RPC_MESSAGES[error.message ?? ''];
  if (message) return NextResponse.json({ error: message }, { status: 409 });
  return NextResponse.json({ error: 'The action failed. Nothing was changed.' }, { status: 500 });
}
```

- [ ] **Step 4: Write `client.ts`**

```ts
export async function adminPost<T = unknown>(url: string, body: unknown = {}, method = 'POST'): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The action failed.');
  return data as T;
}
```

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no errors in `src/lib/admin/`.

```bash
git add src/lib/admin
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(admin): add server gate and audit helpers"
```

## Task 4: Route guard check, console shell and nav link

**Files:**
- Create: `src/lib/admin/__verify__/admin-routes.verify.ts`, `src/app/api/me/staff-role/route.ts`, `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/components/admin/admin-nav.tsx`
- Modify: `src/components/dashboard-navbar.tsx`

- [ ] **Step 1: Write the route guard check**

```ts
/**
 * Fails if any /api/admin handler does not call the gate first, so a new route
 * cannot ship unprotected.
 * Run: npx tsx src/lib/admin/__verify__/admin-routes.verify.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const API = join(process.cwd(), 'src', 'app', 'api');
const ROOT = join(API, 'admin');
const METHODS = 'GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS';
const ASYNC_HANDLER = new RegExp(String.raw`^export async function (${METHODS})\b[^{]*\{[ \t]*$`);
const ANY_EXPORT = [
  new RegExp(String.raw`export\s+(?:async\s+)?function\s+(${METHODS})\b`, 'g'),
  new RegExp(String.raw`export\s+(?:const|let|var)\s+(${METHODS})\b`, 'g'),
];
const REEXPORT = /export\s*(?:type\s*)?\{([^}]*)\}/g;
const GATE = /^const gate = await requirePermission\('[a-z]+\.[a-z]+'\);$/;
const GATE_RETURN = 'if (!gate.ok) return gate.response;';

function routes(dir: string): string[] {
  let found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found = found.concat(routes(path));
    else if (name === 'route.ts' || name === 'route.tsx') found.push(path);
  }
  return found;
}

if (!existsSync(API)) {
  console.error(`  ✗ ${API} does not exist: run this from the repository root`);
  process.exit(1);
}

let handlers = 0;
const failures: string[] = [];
for (const file of existsSync(ROOT) ? routes(ROOT) : []) {
  const source = readFileSync(file, 'utf8');
  const lines = source.split(/\r?\n/);

  // Any export form other than `export async function X` is refused.
  const exported = new Set<string>();
  for (const re of ANY_EXPORT) for (const m of Array.from(source.matchAll(re))) exported.add(m[1]);
  for (const m of Array.from(source.matchAll(REEXPORT))) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()!.trim();
      if (new RegExp(`^(${METHODS})$`).test(name)) exported.add(name);
    }
  }

  const checked = new Set<string>();
  lines.forEach((line, i) => {
    const m = ASYNC_HANDLER.exec(line);
    if (!m) return;
    handlers++;
    checked.add(m[1]);
    const rest = lines.slice(i + 1);
    const first = rest.findIndex((l) => l.trim() !== '');
    const second = first < 0 ? -1 : rest.slice(first + 1).findIndex((l) => l.trim() !== '');
    const a = first < 0 ? '' : rest[first].trim();
    const b = second < 0 ? '' : rest.slice(first + 1)[second].trim();
    if (!GATE.test(a)) failures.push(`${file} ${m[1]}: first statement is "${a}"`);
    else if (b !== GATE_RETURN) failures.push(`${file} ${m[1]}: next line is "${b}", expected the gate return`);
  });

  for (const name of Array.from(exported)) {
    if (!checked.has(name)) failures.push(`${file} ${name}: exported in a form other than "export async function ${name}(...) {"`);
  }
}

console.log(`${handlers} handlers checked`);
failures.forEach((f) => console.error('  ✗', f));
process.exit(failures.length ? 1 : 0);
```

Run: `npx tsx src/lib/admin/__verify__/admin-routes.verify.ts`
Expected: `0 handlers checked`, exit 0, because no admin routes exist yet. It exits 1 if `src/app/api` is missing (wrong directory). It checks every handler in `route.ts` and `route.tsx`: the first statement must be the gate line, the next must be `if (!gate.ok) return gate.response;`, and any export form other than `export async function X` fails. Every later route must pass this script.

Handler signatures in `src/app/api/admin/` must not contain `{` before the body. Write them as `export async function POST(request: Request, context: Ctx)`, with `type Ctx = { params: { id: string } }` at the top of the file.

- [ ] **Step 2: Write the role endpoint**

`src/app/api/me/staff-role/route.ts` returns only the caller's own role, and lives outside `/api/admin` so ordinary members get a clean 200.

```ts
import { NextResponse } from 'next/server';
import { getStaffContext } from '@/lib/admin/gate';

export const dynamic = 'force-dynamic';

export async function GET() {
  const staff = await getStaffContext();
  return NextResponse.json({ role: staff?.role ?? null });
}
```

- [ ] **Step 3: Write the shell**

`src/components/admin/admin-nav.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, LifeBuoy, Megaphone, ScrollText, Users, type LucideIcon } from 'lucide-react';
import { can, type Permission, type StaffRole } from '@/lib/admin/permissions';

const ITEMS: { href: string; label: string; icon: LucideIcon; permission: Permission }[] = [
  { href: '/admin/support', label: 'Support', icon: LifeBuoy, permission: 'tickets.work' },
  { href: '/admin/users', label: 'Users', icon: Users, permission: 'users.view' },
  { href: '/admin/errors', label: 'Errors', icon: Activity, permission: 'errors.view' },
  { href: '/admin/comms', label: 'Comms', icon: Megaphone, permission: 'comms.send' },
  { href: '/admin/audit', label: 'Audit log', icon: ScrollText, permission: 'audit.view' },
];

export function AdminNav({ role }: { role: StaffRole }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex md:flex-col gap-1 overflow-x-auto">
      {ITEMS.filter((item) => can(role, item.permission)).map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors ${
              active ? 'bg-violet-500/20 text-violet-100' : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

`src/app/admin/layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import DashboardNavbar from '@/components/dashboard-navbar';
import { AdminNav } from '@/components/admin/admin-nav';
import { getStaffContext } from '@/lib/admin/gate';

export const metadata = { title: 'Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await getStaffContext();
  if (!staff) notFound();

  return (
    <div className="min-h-screen bg-black text-white">
      <DashboardNavbar />
      <div className="container mx-auto max-w-7xl px-4 py-6 grid md:grid-cols-[180px_1fr] gap-6">
        <AdminNav role={staff.role} />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
```

`src/app/admin/page.tsx` (Next 14 renders layout and page concurrently, so the layout's `notFound()` does not stop the page; every page gates itself):

```tsx
import { redirect } from 'next/navigation';
import { requirePagePermission } from '@/lib/admin/gate';

export default async function AdminHome() {
  await requirePagePermission('tickets.work');
  redirect('/admin/support');
}
```

- [ ] **Step 4: Add the nav link**

In `src/components/dashboard-navbar.tsx`:

Add `Shield,` to the lucide import list, and `useEffect` to the React import:

```tsx
import { useEffect, useState } from 'react'
```

After `const [submitSuccess, setSubmitSuccess] = useState(false)` add:

```tsx
  const [isStaff, setIsStaff] = useState(false)

  useEffect(() => {
    fetch('/api/me/staff-role')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setIsStaff(!!data?.role))
      .catch(() => {})
  }, [])
```

In the User Menu, after the Settings `DropdownMenuItem` and before the separator, add:

```tsx
                {isStaff && (
                  <DropdownMenuItem onClick={() => router.push('/admin')} className="cursor-pointer hover:bg-white/5">
                    <Shield className="w-4 h-4 mr-2" />
                    Admin
                  </DropdownMenuItem>
                )}
```

- [ ] **Step 5: Build and commit**

Run: `npm run build`
Expected: succeeds, with `/admin` in the route list.

```bash
git add src
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(admin): add console shell, nav link and route guard check"
```

---

# Phase 2: Users

## Task 5: Plan guard and sync protection

**Files:**
- Create: `src/lib/admin/plan-guard.ts`, `src/lib/admin/__verify__/admin-plan-guard.verify.ts`
- Modify: `src/lib/nexus/tier.ts:65-71`, `src/app/api/webhooks/stripe/route.ts:616`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * Which plans the console may edit, and that admin plans survive the Nexus sync.
 * Run: npx tsx src/lib/admin/__verify__/admin-plan-guard.verify.ts
 */
import { planEditBlock, type PlanGuardRow } from '../plan-guard';
import { decideTierSync } from '../../nexus/tier';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗', name); }
}

const row = (over: Partial<PlanGuardRow>): PlanGuardRow => ({
  plan_id: 'free', status: 'active', stripe_subscription_id: null, plan_source: null, ...over,
});

check('free is editable', planEditBlock(row({})) === null);
check('admin grant is editable', planEditBlock(row({ plan_id: 'pro', plan_source: 'admin' })) === null);
check('active Stripe blocked', planEditBlock(row({ plan_id: 'pro', stripe_subscription_id: 'sub_1' })) === 'stripe_managed');
check('trialing Stripe blocked', planEditBlock(row({ status: 'trialing', stripe_subscription_id: 'sub_1' })) === 'stripe_managed');
check('past_due Stripe blocked', planEditBlock(row({ status: 'past_due', stripe_subscription_id: 'sub_1' })) === 'stripe_managed');
check('canceled Stripe editable', planEditBlock(row({ status: 'canceled', stripe_subscription_id: 'sub_1' })) === null);
check('Nexus blocked', planEditBlock(row({ plan_id: 'pro', plan_source: 'nexus' })) === 'nexus_managed');
check('lifetime blocked', planEditBlock(row({ plan_id: 'lifetime' })) === 'lifetime_plan');

const now = new Date('2026-11-01T00:00:00Z');
const adminPro = { plan_id: 'pro', status: 'active', stripe_subscription_id: null, plan_source: 'admin' };
const lapsed = { ok: true as const, tier: 'hacker' as never, active: false };
const decision = decideTierSync(adminPro, lapsed, now);
check('sync leaves an admin plan alone', decision.outcome === 'protected' && decision.planAfter === 'pro');
check('sync writes only the check time', Object.keys(decision.patch ?? {}).join() === 'nexus_checked_at');

const nexusPro = { ...adminPro, plan_source: 'nexus' };
check('sync still revokes a Nexus plan', decideTierSync(nexusPro, lapsed, now).outcome === 'revoked_to_free');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx tsx src/lib/admin/__verify__/admin-plan-guard.verify.ts`
Expected: FAIL, cannot find module `../plan-guard`.

- [ ] **Step 3: Implement `plan-guard.ts`**

```ts
/**
 * Why the console may not edit a plan. The UI uses this to explain; the
 * admin_set_plan RPC enforces the same rules. Keep the two in step.
 */

export interface PlanGuardRow {
  plan_id: string;
  status: string;
  stripe_subscription_id: string | null;
  plan_source: string | null;
}

export type PlanBlock = 'stripe_managed' | 'nexus_managed' | 'lifetime_plan';

export const ADMIN_PLANS = ['free', 'pro', 'beta_tester'] as const;
export type AdminPlan = (typeof ADMIN_PLANS)[number];

const ENDED_STATUSES = ['canceled', 'incomplete_expired'];

export function planEditBlock(row: PlanGuardRow): PlanBlock | null {
  if (row.plan_id === 'lifetime') return 'lifetime_plan';
  if (row.stripe_subscription_id && !ENDED_STATUSES.includes(row.status)) return 'stripe_managed';
  if (row.plan_source === 'nexus') return 'nexus_managed';
  return null;
}
```

- [ ] **Step 4: Protect admin plans in the sync**

In `src/lib/nexus/tier.ts`, replace `isProtected`:

```ts
function isProtected(row: SubscriptionSyncRow): boolean {
  const activeStripe =
    row.stripe_subscription_id != null && (row.status === 'active' || row.status === 'trialing');
  const ownedPlan =
    (row.plan_id === 'lifetime' || row.plan_id === 'beta_tester') && row.plan_source !== 'nexus';
  return activeStripe || ownedPlan || row.plan_source === 'admin';
}
```

- [ ] **Step 5: Protect admin plans in the Stripe webhook**

In `src/app/api/webhooks/stripe/route.ts`, replace lines 616-619:

```ts
        const planSource = (subscriptionRecord as any)?.plan_source;
        if (subscriptionRecord && (planSource === 'nexus' || planSource === 'admin')) {
          // The plan comes from the member's Nexus tier (D182 §5) or an admin
          // grant, not from this Stripe subscription: forget the subscription,
          // keep the plan, and leave the credit allowance alone.
```

- [ ] **Step 6: Run it to confirm it passes**

Run: `npx tsx src/lib/admin/__verify__/admin-plan-guard.verify.ts`
Expected: all pass. If `tier: 'hacker' as never` fails, check the tier names in `src/lib/nexus/handoff.ts`, not the guard.

- [ ] **Step 7: Commit**

```bash
git add src/lib/admin src/lib/nexus/tier.ts src/app/api/webhooks/stripe/route.ts
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(admin): guard plan edits and protect admin plans from sync"
```

## Task 6: Users migration

**Files:**
- Create: `supabase/migrations/20261031000002_admin_users.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Admin user management. All service-role-only.
--
-- plan_id is written only when it changes, because on_subscription_change fires
-- on any UPDATE OF plan_id and resets monthly_allowance. The edit rules here
-- must stay in step with src/lib/admin/plan-guard.ts.

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_source_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_source_check
  CHECK (plan_source IN ('stripe', 'nexus', 'admin'));

CREATE OR REPLACE FUNCTION public.admin_set_plan(
  p_actor uuid,
  p_target uuid,
  p_plan text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.subscriptions%ROWTYPE;
BEGIN
  PERFORM public.admin_require_role(p_actor, ARRAY['admin', 'owner']);

  IF p_plan NOT IN ('free', 'pro', 'beta_tester') THEN
    RAISE EXCEPTION 'invalid_plan';
  END IF;

  SELECT * INTO v_row FROM public.subscriptions WHERE user_id = p_target FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_subscription'; END IF;

  IF v_row.plan_id::text = 'lifetime' THEN RAISE EXCEPTION 'lifetime_plan'; END IF;
  IF v_row.stripe_subscription_id IS NOT NULL
     AND v_row.status::text NOT IN ('canceled', 'incomplete_expired') THEN
    RAISE EXCEPTION 'stripe_managed';
  END IF;
  IF v_row.plan_source = 'nexus' THEN RAISE EXCEPTION 'nexus_managed'; END IF;
  IF v_row.plan_id::text = p_plan THEN RAISE EXCEPTION 'no_change'; END IF;

  UPDATE public.subscriptions
     SET plan_id = p_plan::public.plan_type,
         status = 'active'::public.subscription_status,
         plan_source = CASE WHEN p_plan = 'free' THEN NULL ELSE 'admin' END
   WHERE user_id = p_target;

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, before, after, reason, outcome)
  VALUES (
    p_actor, 'plan.set', 'user', p_target::text,
    jsonb_build_object('plan', v_row.plan_id, 'source', v_row.plan_source),
    jsonb_build_object('plan', p_plan),
    p_reason, 'succeeded'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_credits(
  p_actor uuid,
  p_target uuid,
  p_amount integer,
  p_reason text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_addon integer;
  v_allowance integer;
  v_used integer;
  v_new integer;
BEGIN
  PERFORM public.admin_require_role(p_actor, ARRAY['admin', 'owner']);

  SELECT addon_credits, monthly_allowance, used_this_period
    INTO v_addon, v_allowance, v_used
    FROM public.ai_credits WHERE user_id = p_target FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_credit_record'; END IF;

  v_new := v_addon + p_amount;
  IF v_new < 0 THEN RAISE EXCEPTION 'negative_balance'; END IF;

  UPDATE public.ai_credits SET addon_credits = v_new WHERE user_id = p_target;

  INSERT INTO public.ai_credit_transactions (user_id, amount, balance_after, reason, transaction_type)
  VALUES (p_target, p_amount, v_allowance + v_new - v_used, 'Admin: ' || p_reason, 'manual_adjustment');

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, before, after, reason, outcome)
  VALUES (
    p_actor, 'credits.adjust', 'user', p_target::text,
    jsonb_build_object('addon_credits', v_addon), jsonb_build_object('addon_credits', v_new),
    p_reason, 'succeeded'
  );

  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search text DEFAULT NULL,
  p_plan text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  plan_id text,
  role text,
  used_this_period integer,
  monthly_allowance integer,
  addon_credits integer,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  created_at timestamptz,
  total bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    u.id,
    u.email::text,
    COALESCE(p.full_name, p.name),
    COALESCE(s.plan_id::text, 'free'),
    r.role,
    c.used_this_period,
    c.monthly_allowance,
    c.addon_credits,
    u.last_sign_in_at,
    u.banned_until,
    u.created_at,
    count(*) OVER ()
  FROM auth.users u
  LEFT JOIN public.users p ON p.id = u.id
  LEFT JOIN public.subscriptions s ON s.user_id = u.id
  LEFT JOIN public.ai_credits c ON c.user_id = u.id
  LEFT JOIN public.staff_roles r ON r.user_id = u.id
  WHERE (
      p_search IS NULL OR p_search = ''
      OR position(lower(p_search) IN lower(u.email)) > 0
      OR position(lower(p_search) IN lower(COALESCE(p.full_name, p.name, ''))) > 0
    )
    AND (p_plan IS NULL OR COALESCE(s.plan_id::text, 'free') = p_plan)
    AND (p_role IS NULL OR r.role = p_role)
  ORDER BY u.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_plan(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_users(text, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_plan(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, text, integer, integer) TO service_role;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20261031000002_admin_users.sql
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(admin): add plan, credit and user list RPCs"
```

## Task 7: User list

**Files:**
- Create: `src/components/ui/table.tsx`, `src/lib/admin/users.ts`, `src/app/admin/users/page.tsx`

- [ ] **Step 1: Add the table primitive**

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

export function TableHeader(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TableBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b border-white/10 hover:bg-white/[0.03]', className)} {...props} />;
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('h-10 px-3 text-left font-medium text-white/50 whitespace-nowrap', className)} {...props} />;
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-2.5 align-middle', className)} {...props} />;
}
```

- [ ] **Step 2: Write `users.ts`**

```ts
import { getSupabaseAdmin } from '@/supabase/admin';
import { isStaffRole, type StaffRole } from './permissions';
import type { PlanGuardRow } from './plan-guard';

export const USERS_PAGE_SIZE = 50;

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  plan_id: string;
  role: string | null;
  used_this_period: number | null;
  monthly_allowance: number | null;
  addon_credits: number | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
  created_at: string;
  total: number;
}

export async function listUsers(filters: { search?: string; plan?: string; role?: string; page: number }) {
  const { data, error } = await getSupabaseAdmin().rpc('admin_list_users', {
    p_search: filters.search || null,
    p_plan: filters.plan || null,
    p_role: filters.role || null,
    p_limit: USERS_PAGE_SIZE,
    p_offset: (filters.page - 1) * USERS_PAGE_SIZE,
  });
  if (error) throw error;
  const rows = (data ?? []) as AdminUserRow[];
  return { rows, total: rows[0]?.total ?? 0 };
}

export interface AdminUserDetail {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  bannedUntil: string | null;
  role: StaffRole | null;
  subscription: (PlanGuardRow & { stripe_customer_id: string | null }) | null;
  credits: { monthly_allowance: number; used_this_period: number; addon_credits: number; used_today: number } | null;
  canvasCount: number;
  nexusMemberId: string | null;
  audit: { id: string; action: string; outcome: string; reason: string | null; created_at: string }[];
}

export async function getUserDetail(id: string): Promise<AdminUserDetail | null> {
  const admin = getSupabaseAdmin();
  const { data: authData, error } = await admin.auth.admin.getUserById(id);
  if (error || !authData.user) return null;
  const user = authData.user;

  const [profile, subscription, credits, role, nexus, canvases, audit] = await Promise.all([
    admin.from('users').select('full_name, name').eq('id', id).maybeSingle(),
    admin
      .from('subscriptions')
      .select('plan_id, status, stripe_subscription_id, stripe_customer_id, plan_source')
      .eq('user_id', id)
      .maybeSingle(),
    admin
      .from('ai_credits')
      .select('monthly_allowance, used_this_period, addon_credits, used_today')
      .eq('user_id', id)
      .maybeSingle(),
    admin.from('staff_roles').select('role').eq('user_id', id).maybeSingle(),
    admin.from('nexus_links').select('member_id').eq('user_id', id).maybeSingle(),
    admin.from('cxd_projects').select('id', { count: 'exact', head: true }).eq('owner_id', id),
    admin
      .from('admin_audit_log')
      .select('id, action, outcome, reason, created_at')
      .eq('target_type', 'user')
      .eq('target_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  return {
    id,
    email: user.email ?? '',
    name: profile.data?.full_name ?? profile.data?.name ?? null,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    bannedUntil: (user as { banned_until?: string | null }).banned_until ?? null,
    role: isStaffRole(role.data?.role) ? role.data.role : null,
    subscription: subscription.data ?? null,
    credits: credits.data ?? null,
    canvasCount: canvases.count ?? 0,
    nexusMemberId: nexus.data?.member_id ?? null,
    audit: audit.data ?? [],
  };
}

export async function getTargetRole(id: string): Promise<StaffRole | null> {
  const { data } = await getSupabaseAdmin().from('staff_roles').select('role').eq('user_id', id).maybeSingle();
  return isStaffRole(data?.role) ? data.role : null;
}

export function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toISOString().slice(0, 10) : '—';
}
```

- [ ] **Step 3: Write the page**

`src/app/admin/users/page.tsx`:

```tsx
import Link from 'next/link';
import { requirePagePermission } from '@/lib/admin/gate';
import { USERS_PAGE_SIZE, formatDate, listUsers } from '@/lib/admin/users';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const FIELD = 'h-9 rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string; plan?: string; role?: string; page?: string };
}) {
  await requirePagePermission('users.view');
  const page = Math.max(1, Number(searchParams.page) || 1);
  const { rows, total } = await listUsers({
    search: searchParams.q,
    plan: searchParams.plan,
    role: searchParams.role,
    page,
  });
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (searchParams.q) params.set('q', searchParams.q);
    if (searchParams.plan) params.set('plan', searchParams.plan);
    if (searchParams.role) params.set('role', searchParams.role);
    params.set('page', String(target));
    return `/admin/users?${params}`;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Users</h1>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={searchParams.q} placeholder="Name or email" aria-label="Search" className={`${FIELD} flex-1 min-w-48`} />
        <select name="plan" defaultValue={searchParams.plan ?? ''} aria-label="Plan" className={FIELD}>
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="lifetime">Lifetime</option>
          <option value="beta_tester">Beta tester</option>
        </select>
        <select name="role" defaultValue={searchParams.role ?? ''} aria-label="Role" className={FIELD}>
          <option value="">All roles</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
        </select>
        <button type="submit" className={`${FIELD} hover:bg-white/10`}>Filter</button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Credits used</TableHead>
            <TableHead>Last sign-in</TableHead>
            <TableHead>Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <Link href={`/admin/users/${user.id}`} className="text-violet-200 hover:underline">
                  {user.name || user.email}
                </Link>
                <div className="text-xs text-white/40">{user.email}</div>
              </TableCell>
              <TableCell>{user.plan_id}</TableCell>
              <TableCell>{user.used_this_period ?? 0} / {user.monthly_allowance ?? 0}</TableCell>
              <TableCell>{formatDate(user.last_sign_in_at)}</TableCell>
              <TableCell>{user.role ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {rows.length === 0 && <p className="text-sm text-white/50">No users match these filters.</p>}

      <div className="flex items-center justify-between text-sm text-white/50">
        <span>{total} users</span>
        <div className="flex gap-3">
          {page > 1 && <Link href={pageHref(page - 1)} className="hover:text-white">Previous</Link>}
          {page * USERS_PAGE_SIZE < total && <Link href={pageHref(page + 1)} className="hover:text-white">Next</Link>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no new errors.

```bash
git add src
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(admin): add user list"
```

## Task 8: User action routes

**Files:**
- Create: `src/app/api/admin/users/[id]/plan/route.ts`, `.../credits/route.ts`, `.../role/route.ts`, `.../suspend/route.ts`, `.../password-reset/route.ts`, `emails/password-reset.tsx`, `src/app/auth/recovery/page.tsx`, `src/app/auth/recovery/confirm/route.ts`

- [ ] **Step 1: Write the plan route**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { parseBody, rpcError } from '@/lib/admin/http';
import { ADMIN_PLANS } from '@/lib/admin/plan-guard';

type Ctx = { params: { id: string } };

const schema = z.object({
  plan: z.enum(ADMIN_PLANS),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: Request, context: Ctx) {
  const gate = await requirePermission('users.edit');
  if (!gate.ok) return gate.response;
  const body = await parseBody(request, schema);
  if (!body.ok) return body.response;

  const { error } = await getSupabaseAdmin().rpc('admin_set_plan', {
    p_actor: gate.staff.userId,
    p_target: context.params.id,
    p_plan: body.data.plan,
    p_reason: body.data.reason,
  });
  if (error) return rpcError(error);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Write the credits route**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { parseBody, rpcError } from '@/lib/admin/http';

type Ctx = { params: { id: string } };

const schema = z.object({
  amount: z.number().int().min(-100000).max(100000).refine((n) => n !== 0),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: Request, context: Ctx) {
  const gate = await requirePermission('users.edit');
  if (!gate.ok) return gate.response;
  const body = await parseBody(request, schema);
  if (!body.ok) return body.response;

  const { data, error } = await getSupabaseAdmin().rpc('admin_adjust_credits', {
    p_actor: gate.staff.userId,
    p_target: context.params.id,
    p_amount: body.data.amount,
    p_reason: body.data.reason,
  });
  if (error) return rpcError(error);
  return NextResponse.json({ ok: true, addonCredits: data });
}
```

- [ ] **Step 3: Write the role route**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { parseBody, rpcError } from '@/lib/admin/http';
import { ASSIGNABLE_ROLES } from '@/lib/admin/permissions';

type Ctx = { params: { id: string } };

const schema = z.object({
  role: z.enum(ASSIGNABLE_ROLES).nullable(),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: Request, context: Ctx) {
  const gate = await requirePermission('roles.assign');
  if (!gate.ok) return gate.response;
  const body = await parseBody(request, schema);
  if (!body.ok) return body.response;

  const { error } = await getSupabaseAdmin().rpc('admin_set_role', {
    p_actor: gate.staff.userId,
    p_target: context.params.id,
    p_role: body.data.role,
    p_reason: body.data.reason,
  });
  if (error) return rpcError(error);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Write the suspend route**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { withAudit } from '@/lib/admin/audit';
import { parseBody } from '@/lib/admin/http';
import { canSuspend } from '@/lib/admin/permissions';
import { getTargetRole } from '@/lib/admin/users';

type Ctx = { params: { id: string } };

// Supabase has no permanent ban; 100 years stands in for one until restored.
const SUSPENDED = '876000h';

const REFUSED = {
  self: 'You cannot suspend your own account.',
  owner: 'Owner accounts cannot be suspended.',
  role_holder: 'Only an Owner can suspend someone who holds a role.',
};

const schema = z.object({
  suspended: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: Request, context: Ctx) {
  const gate = await requirePermission('users.edit');
  if (!gate.ok) return gate.response;
  const body = await parseBody(request, schema);
  if (!body.ok) return body.response;
  const targetId = context.params.id;

  const block = canSuspend({
    actorId: gate.staff.userId,
    actorRole: gate.staff.role,
    targetId,
    targetRole: await getTargetRole(targetId),
  });
  if (block) return NextResponse.json({ error: REFUSED[block] }, { status: 409 });

  try {
    await withAudit(
      {
        actorId: gate.staff.userId,
        action: body.data.suspended ? 'user.suspend' : 'user.restore',
        targetType: 'user',
        targetId,
        reason: body.data.reason,
      },
      async () => {
        const { error } = await getSupabaseAdmin().auth.admin.updateUserById(targetId, {
          ban_duration: body.data.suspended ? SUSPENDED : 'none',
        });
        if (error) throw error;
      },
    );
  } catch {
    return NextResponse.json({ error: 'The account was not changed.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Write the password reset route**

Do not call `supabase.auth.resetPasswordForEmail` here. The app's reset flow is PKCE, so the code verifier would be stored in the admin's browser and the link would fail for the user. Generate a recovery token on the server instead. Send it with `sendEmail` directly, not `enqueueEmail`, so the token is not stored in Inngest's event history.

`src/app/api/admin/users/[id]/password-reset/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { withAudit } from '@/lib/admin/audit';
import { sendEmail } from '@/lib/email';
import PasswordReset from '@emails/password-reset';

type Ctx = { params: { id: string } };

export async function POST(_request: Request, context: Ctx) {
  const gate = await requirePermission('users.edit');
  if (!gate.ok) return gate.response;
  const targetId = context.params.id;
  const admin = getSupabaseAdmin();

  const { data } = await admin.auth.admin.getUserById(targetId);
  const email = data.user?.email;
  if (!email) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  try {
    await withAudit(
      { actorId: gate.staff.userId, action: 'user.password_reset', targetType: 'user', targetId },
      async () => {
        const { data: link, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
        const hashed = link?.properties?.hashed_token;
        if (error || !hashed) throw error ?? new Error('no recovery token');
        const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/recovery?token_hash=${encodeURIComponent(hashed)}`;
        await sendEmail({
          to: email,
          subject: 'Reset your CXD Canvas password',
          html: await render(PasswordReset({ resetUrl })),
        });
      },
    );
  } catch {
    return NextResponse.json({ error: 'The reset email could not be sent.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
```

`emails/password-reset.tsx`:

```tsx
import { Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';
import { EmailButton } from './_components/email-button';

interface PasswordResetProps {
  resetUrl: string;
}

export default function PasswordReset({ resetUrl }: PasswordResetProps) {
  return (
    <EmailLayout previewText="Reset your CXD Canvas password" showUnsubscribe={false}>
      <Section style={{ padding: '32px 40px', textAlign: 'center' as const }}>
        <Text style={{ color: '#edfcfc', fontSize: '15px', lineHeight: '1.7', margin: '0 0 24px' }}>
          Our support team sent you this link to reset your password. It works once.
        </Text>
        <EmailButton href={resetUrl}>Reset password</EmailButton>
        <Text style={{ color: '#6b6b7b', fontSize: '12px', margin: '24px 0 0' }}>
          If you did not ask for this, you can ignore this email and your password stays the same.
        </Text>
      </Section>
    </EmailLayout>
  );
}

PasswordReset.PreviewProps = {
  resetUrl: 'https://canvas.cyberdelic.design/auth/recovery?token_hash=abc123',
} satisfies PasswordResetProps;
```

`src/app/auth/recovery/page.tsx` shows a button, and opening the link changes nothing, because mail scanners open links and would use up the one-time token:

```tsx
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Reset password', robots: { index: false, follow: false } };

export default function RecoveryPage({ searchParams }: { searchParams: { token_hash?: string } }) {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <form action="/auth/recovery/confirm" method="POST" className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">Reset your password</h1>
        <input type="hidden" name="token_hash" value={searchParams.token_hash ?? ''} />
        <Button type="submit">Continue</Button>
      </form>
    </main>
  );
}
```

`src/app/auth/recovery/confirm/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';

export async function POST(request: Request) {
  const form = await request.formData();
  const tokenHash = form.get('token_hash');
  const origin = new URL(request.url).origin;

  if (typeof tokenHash === 'string' && tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    // 303 so the browser follows the redirect with GET.
    if (!error) return NextResponse.redirect(new URL('/dashboard/reset-password', origin), 303);
  }
  return NextResponse.redirect(new URL('/forgot-password', origin), 303);
}
```

- [ ] **Step 6: Check routes and commit**

Run: `npx tsx src/lib/admin/__verify__/admin-routes.verify.ts`
Expected: `5 handlers checked`, exit 0.

Run: `npx tsc --noEmit`
Expected: no new errors.

```bash
git add src emails
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(admin): add user action routes"
```

## Task 9: User detail page

**Files:**
- Create: `src/app/admin/users/[id]/page.tsx`, `src/components/admin/user-actions.tsx`

- [ ] **Step 1: Write the actions component**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { adminPost } from '@/lib/admin/client';
import { ADMIN_PLANS, type PlanBlock } from '@/lib/admin/plan-guard';
import { canSuspend, type StaffRole } from '@/lib/admin/permissions';

const FIELD = 'h-9 w-full rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white';

const PLAN_BLOCK_TEXT: Record<PlanBlock, string> = {
  stripe_managed: 'Managed by Stripe. Change it in the Stripe dashboard, or the user keeps being charged and the next webhook overwrites this.',
  nexus_managed: 'Managed by Cyberdelic Nexus. The tier sync would overwrite a change made here.',
  lifetime_plan: 'Lifetime plans cannot be changed here.',
};

interface Props {
  actor: { id: string; role: StaffRole; canEdit: boolean; canAssign: boolean };
  target: { id: string; role: StaffRole | null; plan: string; planBlock: PlanBlock | null; suspended: boolean };
}

export function UserActions({ actor, target }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [plan, setPlan] = useState(target.plan);
  const [amount, setAmount] = useState('');
  const [role, setRole] = useState<string>(target.role ?? '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(url: string, body: unknown, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      await adminPost(url, body);
      setMessage({ ok: true, text: done });
      setReason('');
      router.refresh();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const base = `/api/admin/users/${target.id}`;
  const hasReason = reason.trim().length >= 3;
  const suspendBlock = canSuspend({ actorId: actor.id, actorRole: actor.role, targetId: target.id, targetRole: target.role });

  if (!actor.canEdit && !actor.canAssign) return null;

  return (
    <section className="space-y-4 rounded-lg border border-white/10 p-4">
      <h2 className="font-medium">Actions</h2>
      <div className="space-y-1">
        <label htmlFor="reason" className="text-sm text-white/60">Reason (required, saved to the audit log)</label>
        <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className={FIELD} />
      </div>

      {actor.canEdit && (
        <>
          <div className="space-y-1">
            <label htmlFor="plan" className="text-sm text-white/60">Plan</label>
            {target.planBlock ? (
              <p className="text-sm text-white/50">{PLAN_BLOCK_TEXT[target.planBlock]}</p>
            ) : (
              <div className="flex gap-2">
                <select id="plan" value={plan} onChange={(e) => setPlan(e.target.value)} className={FIELD}>
                  {ADMIN_PLANS.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <Button
                  size="sm"
                  disabled={busy || !hasReason || plan === target.plan}
                  onClick={() => run(`${base}/plan`, { plan, reason }, 'Plan changed.')}
                >
                  Change
                </Button>
              </div>
            )}
            {!target.planBlock && <p className="text-xs text-white/40">Changing plan resets the monthly credit allowance to the new plan's amount.</p>}
          </div>

          <div className="space-y-1">
            <label htmlFor="credits" className="text-sm text-white/60">Add or remove credits (use a minus sign to remove)</label>
            <div className="flex gap-2">
              <input id="credits" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={FIELD} />
              <Button
                size="sm"
                disabled={busy || !hasReason || !Number(amount)}
                onClick={() => run(`${base}/credits`, { amount: Number(amount), reason }, 'Credits adjusted.').then(() => setAmount(''))}
              >
                Apply
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(`${base}/password-reset`, {}, 'Reset email sent.')}>
              Send password reset
            </Button>
            {!suspendBlock && (
              <Button
                size="sm"
                variant={target.suspended ? 'outline' : 'destructive'}
                disabled={busy || !hasReason}
                onClick={() => run(`${base}/suspend`, { suspended: !target.suspended, reason }, target.suspended ? 'Account restored.' : 'Account suspended.')}
              >
                {target.suspended ? 'Restore account' : 'Suspend account'}
              </Button>
            )}
          </div>
          {!target.suspended && !suspendBlock && <p className="text-xs text-white/40">Suspending keeps all data and does not cancel Stripe billing.</p>}
        </>
      )}

      {actor.canAssign && target.role !== 'owner' && (
        <div className="space-y-1">
          <label htmlFor="role" className="text-sm text-white/60">Role</label>
          <div className="flex gap-2">
            <select id="role" value={role} onChange={(e) => setRole(e.target.value)} className={FIELD}>
              <option value="">No role</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
            <Button
              size="sm"
              disabled={busy || !hasReason || role === (target.role ?? '')}
              onClick={() => run(`${base}/role`, { role: role || null, reason }, 'Role updated.')}
            >
              Save
            </Button>
          </div>
        </div>
      )}

      {message && (
        <p role="status" className={`text-sm ${message.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{message.text}</p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Write the page**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePagePermission } from '@/lib/admin/gate';
import { can, isBanned } from '@/lib/admin/permissions';
import { planEditBlock } from '@/lib/admin/plan-guard';
import { formatDate, getUserDetail } from '@/lib/admin/users';
import { listTicketsForUser } from '@/lib/admin/support';
import { UserActions } from '@/components/admin/user-actions';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-white/5">
      <dt className="text-white/50">{label}</dt>
      <dd className="text-right break-all">{children}</dd>
    </div>
  );
}

export default async function AdminUserPage({ params }: { params: { id: string } }) {
  const staff = await requirePagePermission('users.view');
  const user = await getUserDetail(params.id);
  if (!user) notFound();
  const tickets = await listTicketsForUser(user.id);
  const suspended = isBanned(user.bannedUntil, new Date());

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/users" className="text-sm text-white/50 hover:text-white">Users</Link>
        <h1 className="text-xl font-semibold">{user.name || user.email}</h1>
        {suspended && <p className="text-sm text-rose-400">Suspended</p>}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <dl className="rounded-lg border border-white/10 p-4">
          <Row label="Email">{user.email}</Row>
          <Row label="Role">{user.role ?? '—'}</Row>
          <Row label="Joined">{formatDate(user.createdAt)}</Row>
          <Row label="Last sign-in">{formatDate(user.lastSignInAt)}</Row>
          <Row label="Canvases">{user.canvasCount}</Row>
          <Row label="Plan">{user.subscription?.plan_id ?? 'free'}</Row>
          <Row label="Plan status">{user.subscription?.status ?? '—'}</Row>
          <Row label="Plan source">{user.subscription?.plan_source ?? '—'}</Row>
          <Row label="Credits used">{user.credits?.used_this_period ?? 0} / {user.credits?.monthly_allowance ?? 0}</Row>
          <Row label="Add-on credits">{user.credits?.addon_credits ?? 0}</Row>
          <Row label="Nexus member">{user.nexusMemberId ?? '—'}</Row>
          <Row label="Stripe">
            {user.subscription?.stripe_customer_id ? (
              <a
                href={`https://dashboard.stripe.com/customers/${user.subscription.stripe_customer_id}`}
                target="_blank"
                rel="noreferrer"
                className="text-violet-200 hover:underline"
              >
                Open customer
              </a>
            ) : '—'}
          </Row>
        </dl>

        <UserActions
          actor={{
            id: staff.userId,
            role: staff.role,
            canEdit: can(staff.role, 'users.edit'),
            canAssign: can(staff.role, 'roles.assign'),
          }}
          target={{
            id: user.id,
            role: user.role,
            plan: user.subscription?.plan_id ?? 'free',
            planBlock: user.subscription ? planEditBlock(user.subscription) : null,
            suspended,
          }}
        />
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">Support cards</h2>
        {tickets.length === 0 && <p className="text-sm text-white/50">None yet.</p>}
        {tickets.map((ticket) => (
          <Link key={ticket.id} href={`/admin/support/${ticket.id}`} className="block text-sm text-violet-200 hover:underline">
            {ticket.title} ({ticket.status})
          </Link>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Admin history</h2>
        {user.audit.length === 0 && <p className="text-sm text-white/50">None yet.</p>}
        {user.audit.map((entry) => (
          <p key={entry.id} className="text-sm text-white/70">
            {formatDate(entry.created_at)} · {entry.action} · {entry.outcome}{entry.reason ? ` · ${entry.reason}` : ''}
          </p>
        ))}
      </section>
    </div>
  );
}
```

This imports `listTicketsForUser` from Task 13. Commit this task, then run the type-check after Task 13. Do not stub it.

- [ ] **Step 3: Commit**

```bash
git add src
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(admin): add user detail page and actions"
```

## Task 10: Refuse suspended accounts on the Nexus path

The Nexus callback mints a session with a server-side magic link. Do not rely on `verifyOtp` refusing a banned user.

**Files:**
- Modify: `src/app/auth/nexus-callback/route.ts:105-107`

- [ ] **Step 1: Add the check**

Add to the imports:

```ts
import { isBanned } from '@/lib/admin/permissions';
```

Replace lines 105-107 with:

```ts
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    if (userError || !email) return fail(request, 'failed');
    if (isBanned((userData.user as { banned_until?: string | null }).banned_until, new Date())) {
      return fail(request, 'failed');
    }
```

- [ ] **Step 2: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no new errors beyond the pending `listTicketsForUser` import.

```bash
git add src/app/auth/nexus-callback/route.ts
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "fix(auth): refuse suspended accounts on the Nexus sign-in path"
```

---

# Phase 3: Support

## Task 11: Ticket helpers

**Files:**
- Create: `src/lib/admin/tickets.ts`, `src/lib/admin/__verify__/admin-tickets.verify.ts`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * Ticket title and body shaping for /api/support.
 * Run: npx tsx src/lib/admin/__verify__/admin-tickets.verify.ts
 */
import { composeTicketBody, resolveTicketType, ticketTitle } from '../tickets';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗', name); }
}

check('explicit type wins', resolveTicketType('feature', 'Bug Report') === 'feature');
check('legacy bug title', resolveTicketType(undefined, 'Bug Report') === 'bug');
check('legacy default', resolveTicketType(undefined, 'Support Request') === 'support');
check('unknown type falls back', resolveTicketType('nonsense', 'Support Request') === 'support');

check('generic title uses description', ticketTitle('Bug Report', 'The canvas froze') === 'The canvas froze');
check('real title kept', ticketTitle('Export broken', 'Details') === 'Export broken');
check('long description cut at 80', ticketTitle('Support Request', 'x'.repeat(200)).length === 80);
check('first line only', ticketTitle('Bug Report', 'First\nSecond') === 'First');

check('body without steps', composeTicketBody('Hello', undefined) === 'Hello');
check('body with steps', composeTicketBody('Hello', '1. Click').includes('Steps to reproduce:\n1. Click'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx tsx src/lib/admin/__verify__/admin-tickets.verify.ts`
Expected: FAIL, cannot find module `../tickets`.

- [ ] **Step 3: Implement**

```ts
export const TICKET_TYPES = ['bug', 'feature', 'support'] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TICKET_STATUSES = ['new', 'in_progress', 'waiting', 'done'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['low', 'normal', 'high'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  new: 'New',
  in_progress: 'In progress',
  waiting: 'Waiting on user',
  done: 'Done',
};

export const TYPE_LABELS: Record<TicketType, string> = {
  bug: 'Bug',
  feature: 'Feature request',
  support: 'Support',
};

const GENERIC_TITLES = ['Bug Report', 'Support Request', 'Feature Request'];
const TITLE_LENGTH = 80;

export function resolveTicketType(type: unknown, title: string): TicketType {
  if ((TICKET_TYPES as readonly unknown[]).includes(type)) return type as TicketType;
  return title === 'Bug Report' ? 'bug' : 'support';
}

/** The dialogs send a fixed label as the title, which would make every card look alike. */
export function ticketTitle(title: string, description: string): string {
  if (!GENERIC_TITLES.includes(title)) return title.slice(0, TITLE_LENGTH);
  return description.trim().split('\n')[0].slice(0, TITLE_LENGTH);
}

export function composeTicketBody(description: string, stepsToReproduce: string | undefined): string {
  if (!stepsToReproduce) return description;
  return `${description}\n\nSteps to reproduce:\n${stepsToReproduce}`;
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx tsx src/lib/admin/__verify__/admin-tickets.verify.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(admin): add ticket helpers"
```

## Task 12: Support migration

**Files:**
- Create: `supabase/migrations/20261031000003_support_tickets.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Support cards. Requests used to exist only as emails, so nothing could be
-- tracked. Service-role-only: members have no ticket screens.

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  type text NOT NULL CHECK (type IN ('bug', 'feature', 'support')),
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'waiting', 'done')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source_path text,
  sentry_issue_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.support_ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('note', 'reply', 'status', 'assignment')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_events_ticket ON public.support_ticket_events (ticket_id, created_at);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.support_tickets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.support_ticket_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO service_role;
GRANT SELECT, INSERT ON public.support_ticket_events TO service_role;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20261031000003_support_tickets.sql
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(admin): add support ticket tables"
```

## Task 13: Support reads

**Files:**
- Create: `src/lib/admin/support.ts`

- [ ] **Step 1: Write it**

```ts
import { getSupabaseAdmin } from '@/supabase/admin';
import type { TicketPriority, TicketStatus, TicketType } from './tickets';

export interface Ticket {
  id: string;
  user_id: string | null;
  email: string;
  type: TicketType;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee_id: string | null;
  source_path: string | null;
  sentry_issue_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketEvent {
  id: string;
  actor_id: string;
  kind: 'note' | 'reply' | 'status' | 'assignment';
  body: string;
  created_at: string;
}

export interface StaffMember {
  id: string;
  label: string;
}

export async function listTickets(filters: { type?: string; assignee?: string; priority?: string }): Promise<Ticket[]> {
  let query = getSupabaseAdmin()
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.assignee) query = query.eq('assignee_id', filters.assignee);
  if (filters.priority) query = query.eq('priority', filters.priority);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Ticket[];
}

export async function getTicket(id: string): Promise<{ ticket: Ticket; events: TicketEvent[] } | null> {
  const admin = getSupabaseAdmin();
  const { data: ticket } = await admin.from('support_tickets').select('*').eq('id', id).maybeSingle();
  if (!ticket) return null;
  const { data: events } = await admin
    .from('support_ticket_events')
    .select('id, actor_id, kind, body, created_at')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true });
  return { ticket: ticket as Ticket, events: (events ?? []) as TicketEvent[] };
}

export async function listTicketsForUser(userId: string): Promise<Pick<Ticket, 'id' | 'title' | 'status'>[]> {
  const { data } = await getSupabaseAdmin()
    .from('support_tickets')
    .select('id, title, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []) as Pick<Ticket, 'id' | 'title' | 'status'>[];
}

export async function listStaff(): Promise<StaffMember[]> {
  const admin = getSupabaseAdmin();
  const { data: roles } = await admin.from('staff_roles').select('user_id');
  const ids = (roles ?? []).map((row) => row.user_id as string);
  if (ids.length === 0) return [];
  const { data: people } = await admin.from('users').select('id, full_name, email').in('id', ids);
  return (people ?? []).map((person) => ({
    id: person.id as string,
    label: (person.full_name as string | null) || (person.email as string) || 'Staff',
  }));
}
```

- [ ] **Step 2: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no new errors, because Task 9's import now resolves.

```bash
git add src/lib/admin/support.ts
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(admin): add support reads"
```

## Task 14: Save requests and add Feature Request

**Files:**
- Modify: `src/lib/rate-limiter.ts:5-12`, `src/app/api/support/route.ts`, `src/components/dashboard-navbar.tsx`

- [ ] **Step 1: Add the rate limit**

In `src/lib/rate-limiter.ts`:

```ts
type EndpointType = 'sign-in' | 'sign-up' | 'forgot-password' | 'checkout' | 'support';
```

Add to `LIMITS`:

```ts
  'support': { windowMs: 3_600_000, maxRequests: 10 },       // 10 per hour
```

- [ ] **Step 2: Update imports and body parsing in `/api/support`**

Replace the import block's end with these additions:

```ts
import { getSupabaseAdmin } from '@/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limiter';
import { composeTicketBody, resolveTicketType, ticketTitle } from '@/lib/admin/tickets';
```

After the `401` check, add:

```ts
    const limit = checkRateLimit(user.id, 'support');
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }
```

Add `type: requestedType,` and `sourcePath,` to the destructured body fields.

- [ ] **Step 3: Store the ticket and set the type**

Replace lines 67-69:

```ts
    const ticketType = resolveTicketType(requestedType, title);
    // The email templates know two types; a feature request reads as support.
    const type: 'bug' | 'support' = ticketType === 'bug' ? 'bug' : 'support';
    const subjectPrefix =
      ticketType === 'bug' ? 'Bug Report' : ticketType === 'feature' ? 'Feature Request' : 'Support Request';

    // Stored first, but a failed insert must not lose the request: the emails
    // below still go out, and Sentry records the failure.
    try {
      const { error: ticketError } = await getSupabaseAdmin().from('support_tickets').insert({
        user_id: user.id,
        email: reporterEmail,
        type: ticketType,
        title: ticketTitle(title, description),
        description: composeTicketBody(description, stepsToReproduce),
        source_path: typeof sourcePath === 'string' ? sourcePath.slice(0, 500) : null,
      });
      if (ticketError) throw ticketError;
    } catch (ticketErr) {
      console.error('Failed to store support ticket:', ticketErr);
      Sentry.captureException(ticketErr, { tags: { route: 'support', phase: 'store-ticket' } });
    }
```

Change the Sentry tag on line 77 to `reportType: ticketType`.

- [ ] **Step 4: Update the dialogs**

In `src/components/dashboard-navbar.tsx`:

Add `Lightbulb,` to the lucide imports, then add state after `showSupportModal`:

```tsx
  const [supportKind, setSupportKind] = useState<'support' | 'feature'>('support')
```

In `handleSupportSubmit`, replace the JSON body with:

```tsx
        body: JSON.stringify({
          type: supportKind,
          title: supportKind === 'feature' ? 'Feature Request' : 'Support Request',
          description: supportMessage,
          sourcePath: pathname,
          browserInfo,
        }),
```

In `handleBugSubmit`, add to the JSON body:

```tsx
          type: 'bug',
          sourcePath: pathname,
```

Replace the Help Menu's Contact Support item and add the new one:

```tsx
                <DropdownMenuItem
                  onClick={() => { setSupportKind('support'); setShowSupportModal(true) }}
                  className="cursor-pointer hover:bg-white/5"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Contact Support
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setSupportKind('feature'); setShowSupportModal(true) }}
                  className="cursor-pointer hover:bg-white/5"
                >
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Request a Feature
                </DropdownMenuItem>
```

In the Support Modal, make the header and label follow the kind:

```tsx
            <DialogTitle className="flex items-center gap-2 text-xl">
              <MessageCircle className="w-5 h-5 text-violet-400" />
              {supportKind === 'feature' ? 'Request a Feature' : 'Contact Support'}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {supportKind === 'feature'
                ? 'Tell us what would make CXD Canvas more useful.'
                : "Have a question or need help? We're here to assist you."}
            </DialogDescription>
```

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no new errors.

```bash
git add src
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(support): store requests and add feature requests"
```

## Task 15: Email options and reply template

**Files:**
- Modify: `src/lib/email.ts`, `src/lib/email-queue.ts`, `src/inngest/functions.ts`
- Create: `emails/support-reply.tsx`

- [ ] **Step 1: Extend `sendEmail`**

```ts
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}) {
  const resend = getResend();
  if (!resend) {
    console.warn('RESEND_API_KEY not configured, skipping email');
    return null;
  }

  const { data, error } = await resend.emails.send({
    from: options.from || process.env.RESEND_FROM_EMAIL || 'CXD Canvas <noreply@cyberdelic.design>',
    to: options.to,
    subject: options.subject,
    html: options.html,
    replyTo: options.replyTo,
    headers: options.headers,
  });
```

- [ ] **Step 2: Extend `enqueueEmail`**

Add to `EnqueueEmailOptions`:

```ts
  replyTo?: string;
  headers?: Record<string, string>;
  /** Broadcast sends report their delivery result back to this broadcast. */
  broadcastId?: string;
```

Add to the event `data`:

```ts
        replyTo: opts.replyTo,
        headers: opts.headers,
        broadcastId: opts.broadcastId,
```

Change the fallback call:

```ts
    await sendEmail({ to: opts.to, subject: opts.subject, html, replyTo: opts.replyTo, headers: opts.headers });
```

- [ ] **Step 3: Extend the worker**

Add to `EmailSendData`:

```ts
  replyTo?: string;
  headers?: Record<string, string>;
  broadcastId?: string;
```

Add this helper above `sendEmailFn`:

```ts
async function recordBroadcastResult(broadcastId: string, sent: number, failed: number) {
  const { error } = await getSupabaseAdmin().rpc('admin_record_broadcast_result', {
    p_broadcast: broadcastId,
    p_sent: sent,
    p_failed: failed,
  });
  if (error) throw error;
}
```

Replace the function options:

```ts
  {
    id: 'send-email',
    name: 'Send email (Resend)',
    retries: 4, // ~4 attempts over ~1 hour with exponential backoff
    // A broadcast enqueues one event per recipient; stay inside Resend's rate limit.
    throttle: { limit: 2, period: '1s' },
    triggers: [{ event: 'email/send' }],
    onFailure: async ({ event }) => {
      const { broadcastId } = event.data.event.data as EmailSendData;
      if (broadcastId) await recordBroadcastResult(broadcastId, 0, 1);
    },
  },
```

Update destructuring:

```ts
    const { to, subject, html, userId, emailKind, stripeEventId, replyTo, headers, broadcastId } = event.data as EmailSendData;
```

Update the send step:

```ts
      await sendEmail({ to, subject, html, replyTo, headers });
```

Before `return { sent: true, ... }` add:

```ts
    if (broadcastId) {
      await step.run('record-broadcast-result', () => recordBroadcastResult(broadcastId, 1, 0));
    }
```

- [ ] **Step 4: Write `emails/support-reply.tsx`**

```tsx
import { Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';

interface SupportReplyProps {
  userName: string;
  ticketTitle: string;
  body: string;
}

export default function SupportReply({ userName, ticketTitle, body }: SupportReplyProps) {
  return (
    <EmailLayout previewText={`About your request: ${ticketTitle}`} showUnsubscribe={false}>
      <Section style={{ padding: '32px 40px' }}>
        <Text style={{ color: '#a0a0b0', fontSize: '14px', margin: '0 0 16px' }}>Hi {userName},</Text>
        {body.split(/\n{2,}/).map((paragraph, index) => (
          <Text key={index} style={{ color: '#edfcfc', fontSize: '15px', lineHeight: '1.7', margin: '0 0 16px', whiteSpace: 'pre-wrap' as const }}>
            {paragraph}
          </Text>
        ))}
        <Text style={{ color: '#6b6b7b', fontSize: '12px', margin: '16px 0 0' }}>
          About your request: {ticketTitle}
        </Text>
      </Section>
    </EmailLayout>
  );
}

SupportReply.PreviewProps = {
  userName: 'Alex',
  ticketTitle: 'The canvas froze on export',
  body: 'Thanks for reporting this.\n\nWe found the cause and fixed it.',
} satisfies SupportReplyProps;
```

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no new errors. If `replyTo` or `onFailure` typing fails, read the installed `.d.ts`, because the option name is the likely cause.

```bash
git add src emails
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(email): add reply-to, headers and support reply template"
```

## Task 16: Support routes

**Files:**
- Create: `src/app/api/admin/support/[id]/route.ts`, `.../notes/route.ts`, `.../reply/route.ts`

- [ ] **Step 1: Write the update route**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { parseBody } from '@/lib/admin/http';
import { recordAudit } from '@/lib/admin/audit';
import { STATUS_LABELS, TICKET_PRIORITIES, TICKET_STATUSES } from '@/lib/admin/tickets';

type Ctx = { params: { id: string } };

const schema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  sentryIssueUrl: z.string().url().max(500).nullable().optional(),
});

export async function PATCH(request: Request, context: Ctx) {
  const gate = await requirePermission('tickets.work');
  if (!gate.ok) return gate.response;
  const body = await parseBody(request, schema);
  if (!body.ok) return body.response;
  const { status, priority, assigneeId, sentryIssueUrl } = body.data;
  const ticketId = context.params.id;
  const admin = getSupabaseAdmin();

  const { data: before } = await admin.from('support_tickets').select('status, assignee_id, priority').eq('id', ticketId).maybeSingle();
  if (!before) return NextResponse.json({ error: 'Card not found.' }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) patch.status = status;
  if (priority) patch.priority = priority;
  if (assigneeId !== undefined) patch.assignee_id = assigneeId;
  if (sentryIssueUrl !== undefined) patch.sentry_issue_url = sentryIssueUrl;

  const { error } = await admin.from('support_tickets').update(patch).eq('id', ticketId);
  if (error) return NextResponse.json({ error: 'The card was not changed.' }, { status: 500 });

  const events: { ticket_id: string; actor_id: string; kind: string; body: string }[] = [];
  if (status && status !== before.status) {
    events.push({ ticket_id: ticketId, actor_id: gate.staff.userId, kind: 'status', body: `Moved to ${STATUS_LABELS[status]}` });
  }
  if (assigneeId !== undefined && assigneeId !== before.assignee_id) {
    events.push({ ticket_id: ticketId, actor_id: gate.staff.userId, kind: 'assignment', body: assigneeId ? 'Assigned' : 'Unassigned' });
  }
  if (events.length) await admin.from('support_ticket_events').insert(events);

  await recordAudit({
    actorId: gate.staff.userId,
    action: 'ticket.update',
    targetType: 'ticket',
    targetId: ticketId,
    before,
    after: patch,
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Write the notes route**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { parseBody } from '@/lib/admin/http';

type Ctx = { params: { id: string } };

const schema = z.object({ body: z.string().trim().min(1).max(10000) });

export async function POST(request: Request, context: Ctx) {
  const gate = await requirePermission('tickets.work');
  if (!gate.ok) return gate.response;
  const body = await parseBody(request, schema);
  if (!body.ok) return body.response;

  const { error } = await getSupabaseAdmin().from('support_ticket_events').insert({
    ticket_id: context.params.id,
    actor_id: gate.staff.userId,
    kind: 'note',
    body: body.data.body,
  });
  if (error) return NextResponse.json({ error: 'The note was not saved.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Write the reply route**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { parseBody } from '@/lib/admin/http';
import { withAudit } from '@/lib/admin/audit';
import { enqueueEmail } from '@/lib/email-queue';
import SupportReply from '@emails/support-reply';

type Ctx = { params: { id: string } };

const SUPPORT_INBOX = 'contact@cyberdelic.design';

const schema = z.object({ body: z.string().trim().min(1).max(10000) });

export async function POST(request: Request, context: Ctx) {
  const gate = await requirePermission('tickets.work');
  if (!gate.ok) return gate.response;
  const body = await parseBody(request, schema);
  if (!body.ok) return body.response;
  const ticketId = context.params.id;
  const admin = getSupabaseAdmin();

  const { data: ticket } = await admin
    .from('support_tickets')
    .select('email, title, user_id')
    .eq('id', ticketId)
    .maybeSingle();
  if (!ticket) return NextResponse.json({ error: 'Card not found.' }, { status: 404 });

  const { data: profile } = ticket.user_id
    ? await admin.from('users').select('full_name').eq('id', ticket.user_id).maybeSingle()
    : { data: null };

  try {
    await withAudit(
      { actorId: gate.staff.userId, action: 'ticket.reply', targetType: 'ticket', targetId: ticketId },
      () =>
        enqueueEmail({
          to: ticket.email,
          subject: `Re: ${ticket.title}`,
          replyTo: SUPPORT_INBOX,
          template: SupportReply({
            userName: profile?.full_name || 'there',
            ticketTitle: ticket.title,
            body: body.data.body,
          }),
        }),
    );
  } catch {
    return NextResponse.json({ error: 'The reply was not sent.' }, { status: 500 });
  }

  await admin.from('support_ticket_events').insert({
    ticket_id: ticketId,
    actor_id: gate.staff.userId,
    kind: 'reply',
    body: body.data.body,
  });
  await admin
    .from('support_tickets')
    .update({ status: 'waiting', updated_at: new Date().toISOString() })
    .eq('id', ticketId);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Check routes and commit**

Run: `npx tsx src/lib/admin/__verify__/admin-routes.verify.ts`
Expected: `8 handlers checked`, exit 0.

```bash
git add src
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(admin): add support card routes"
```

## Task 17: Support board and card pages

**Files:**
- Create: `src/app/admin/support/page.tsx`, `src/app/admin/support/[id]/page.tsx`, `src/components/admin/ticket-controls.tsx`, `src/components/admin/ticket-compose.tsx`

- [ ] **Step 1: Write the controls**

`src/components/admin/ticket-controls.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminPost } from '@/lib/admin/client';
import { STATUS_LABELS, TICKET_PRIORITIES, TICKET_STATUSES } from '@/lib/admin/tickets';
import type { StaffMember, Ticket } from '@/lib/admin/support';

const FIELD = 'h-9 w-full rounded-md bg-white/5 border border-white/10 px-2 text-sm text-white';

export function TicketControls({ ticket, staff }: { ticket: Ticket; staff: StaffMember[] }) {
  const router = useRouter();
  const [error, setError] = useState('');

  async function update(patch: Record<string, unknown>) {
    setError('');
    try {
      await adminPost(`/api/admin/support/${ticket.id}`, patch, 'PATCH');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-white/10 p-4">
      <div className="space-y-1">
        <label htmlFor="status" className="text-sm text-white/60">Status</label>
        <select id="status" className={FIELD} defaultValue={ticket.status} onChange={(e) => update({ status: e.target.value })}>
          {TICKET_STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="priority" className="text-sm text-white/60">Priority</label>
        <select id="priority" className={FIELD} defaultValue={ticket.priority} onChange={(e) => update({ priority: e.target.value })}>
          {TICKET_PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="assignee" className="text-sm text-white/60">Assignee</label>
        <select id="assignee" className={FIELD} defaultValue={ticket.assignee_id ?? ''} onChange={(e) => update({ assigneeId: e.target.value || null })}>
          <option value="">Unassigned</option>
          {staff.map((member) => <option key={member.id} value={member.id}>{member.label}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="sentry" className="text-sm text-white/60">Sentry issue link</label>
        <input
          id="sentry"
          type="url"
          className={FIELD}
          defaultValue={ticket.sentry_issue_url ?? ''}
          onBlur={(e) => {
            const value = e.target.value.trim() || null;
            if (value !== ticket.sentry_issue_url) update({ sentryIssueUrl: value });
          }}
        />
      </div>
      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Write the compose box**

`src/components/admin/ticket-compose.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { adminPost } from '@/lib/admin/client';

export function TicketCompose({ ticketId, email }: { ticketId: string; email: string }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(path: 'notes' | 'reply') {
    setBusy(true);
    setError('');
    try {
      await adminPost(`/api/admin/support/${ticketId}/${path}`, { body: text });
      setText('');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor="compose" className="text-sm text-white/60">Note or reply</label>
      <Textarea id="compose" value={text} onChange={(e) => setText(e.target.value)} className="bg-white/5 border-white/10 min-h-28" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy || !text.trim()} onClick={() => submit('notes')}>
          Save internal note
        </Button>
        <Button size="sm" disabled={busy || !text.trim()} onClick={() => submit('reply')}>
          Email reply to {email}
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Write the board**

`src/app/admin/support/page.tsx`:

```tsx
import Link from 'next/link';
import { requirePagePermission } from '@/lib/admin/gate';
import { listStaff, listTickets } from '@/lib/admin/support';
import { STATUS_LABELS, TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES, TYPE_LABELS } from '@/lib/admin/tickets';

const FIELD = 'h-9 rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white';

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: { type?: string; assignee?: string; priority?: string };
}) {
  await requirePagePermission('tickets.work');
  const [tickets, staff] = await Promise.all([listTickets(searchParams), listStaff()]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Support</h1>
      <form className="flex flex-wrap gap-2">
        <select name="type" defaultValue={searchParams.type ?? ''} aria-label="Type" className={FIELD}>
          <option value="">All types</option>
          {TICKET_TYPES.map((value) => <option key={value} value={value}>{TYPE_LABELS[value]}</option>)}
        </select>
        <select name="assignee" defaultValue={searchParams.assignee ?? ''} aria-label="Assignee" className={FIELD}>
          <option value="">Anyone</option>
          {staff.map((member) => <option key={member.id} value={member.id}>{member.label}</option>)}
        </select>
        <select name="priority" defaultValue={searchParams.priority ?? ''} aria-label="Priority" className={FIELD}>
          <option value="">Any priority</option>
          {TICKET_PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <button type="submit" className={`${FIELD} hover:bg-white/10`}>Filter</button>
      </form>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {TICKET_STATUSES.map((status) => {
          const column = tickets.filter((ticket) => ticket.status === status);
          return (
            <section key={status} aria-label={STATUS_LABELS[status]} className="space-y-2">
              <h2 className="text-sm font-medium text-white/60">{STATUS_LABELS[status]} ({column.length})</h2>
              {column.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/admin/support/${ticket.id}`}
                  className="block rounded-md border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.06]"
                >
                  <p className="text-sm">{ticket.title}</p>
                  <p className="mt-1 text-xs text-white/40">
                    {TYPE_LABELS[ticket.type]}{ticket.priority === 'high' ? ' · High' : ''} · {ticket.email}
                  </p>
                </Link>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the card page**

`src/app/admin/support/[id]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePagePermission } from '@/lib/admin/gate';
import { getTicket, listStaff } from '@/lib/admin/support';
import { TYPE_LABELS } from '@/lib/admin/tickets';
import { TicketCompose } from '@/components/admin/ticket-compose';
import { TicketControls } from '@/components/admin/ticket-controls';

const KIND_LABELS = { note: 'Internal note', reply: 'Emailed reply', status: 'Status', assignment: 'Assignment' };

export default async function AdminTicketPage({ params }: { params: { id: string } }) {
  await requirePagePermission('tickets.work');
  const [found, staff] = await Promise.all([getTicket(params.id), listStaff()]);
  if (!found) notFound();
  const { ticket, events } = found;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/support" className="text-sm text-white/50 hover:text-white">Support</Link>
        <h1 className="text-xl font-semibold">{ticket.title}</h1>
        <p className="text-sm text-white/50">
          {TYPE_LABELS[ticket.type]} from{' '}
          {ticket.user_id ? (
            <Link href={`/admin/users/${ticket.user_id}`} className="text-violet-200 hover:underline">{ticket.email}</Link>
          ) : ticket.email}
          {ticket.source_path ? ` on ${ticket.source_path}` : ''}
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-4 min-w-0">
          <p className="whitespace-pre-wrap rounded-lg border border-white/10 p-4 text-sm">{ticket.description}</p>
          {events.map((event) => (
            <div key={event.id} className="rounded-md bg-white/[0.03] p-3">
              <p className="text-xs text-white/40">{KIND_LABELS[event.kind]} · {event.created_at.slice(0, 16).replace('T', ' ')}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{event.body}</p>
            </div>
          ))}
          <TicketCompose ticketId={ticket.id} email={ticket.email} />
        </div>
        <TicketControls ticket={ticket} staff={staff} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no new errors.

```bash
git add src
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(admin): add support board and card page"
```

## Task 18: Errors and audit pages

**Files:**
- Create: `src/app/admin/errors/page.tsx`, `src/app/admin/audit/page.tsx`

- [ ] **Step 1: Write the errors page**

```tsx
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePagePermission } from '@/lib/admin/gate';
import { formatDate } from '@/lib/admin/users';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default async function AdminErrorsPage() {
  await requirePagePermission('errors.view');
  const { data } = await getSupabaseAdmin()
    .from('fix_pipeline')
    .select('id, title, level, status, triage_tier, triage_action, event_count, user_count, permalink, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Errors</h1>
        <p className="text-sm text-white/50">Sentry triage, read-only. Acknowledge and snooze in Telegram.</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Issue</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Events</TableHead>
            <TableHead>Users</TableHead>
            <TableHead>Seen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-96 truncate">
                {row.permalink ? (
                  <a href={row.permalink} target="_blank" rel="noreferrer" className="text-violet-200 hover:underline">{row.title}</a>
                ) : row.title}
              </TableCell>
              <TableCell>{row.level ?? '—'}</TableCell>
              <TableCell>{row.triage_tier ?? '—'}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell>{row.event_count ?? 0}</TableCell>
              <TableCell>{row.user_count ?? 0}</TableCell>
              <TableCell>{formatDate(row.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length === 0 && <p className="text-sm text-white/50">No triaged issues.</p>}
    </div>
  );
}
```

- [ ] **Step 2: Write the audit page**

```tsx
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePagePermission } from '@/lib/admin/gate';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default async function AdminAuditPage() {
  await requirePagePermission('audit.view');
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('admin_audit_log')
    .select('id, actor_id, action, target_type, target_id, reason, outcome, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  const rows = data ?? [];

  const actorIds = Array.from(new Set(rows.map((row) => row.actor_id as string)));
  const { data: actors } = actorIds.length
    ? await admin.from('users').select('id, email').in('id', actorIds)
    : { data: [] };
  const actorEmail = new Map((actors ?? []).map((actor) => [actor.id as string, actor.email as string]));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit log</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Who</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap">{(row.created_at as string).slice(0, 16).replace('T', ' ')}</TableCell>
              <TableCell>{actorEmail.get(row.actor_id as string) ?? row.actor_id}</TableCell>
              <TableCell>{row.action}</TableCell>
              <TableCell>{row.target_type} {row.target_id ? (row.target_id as string).slice(0, 8) : ''}</TableCell>
              <TableCell>{row.outcome}</TableCell>
              <TableCell>{row.reason ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length === 0 && <p className="text-sm text-white/50">Nothing recorded yet.</p>}
    </div>
  );
}
```

- [ ] **Step 3: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no new errors.

```bash
git add src
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(admin): add errors and audit pages"
```

---

# Phase 4: Comms

## Task 19: Unsubscribe tokens

**Files:**
- Create: `src/lib/email-unsubscribe.ts`, `src/lib/admin/__verify__/unsubscribe-token.verify.ts`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * Signed unsubscribe tokens.
 * Run: npx tsx src/lib/admin/__verify__/unsubscribe-token.verify.ts
 */
import { signUnsubscribeToken, verifyUnsubscribeToken } from '../../email-unsubscribe';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗', name); }
}

const USER = '322d15dd-8477-41ff-8980-f344fda14164';
const token = signUnsubscribeToken(USER, 'secret-one');

check('round trip', verifyUnsubscribeToken(token, 'secret-one') === USER);
check('wrong secret refused', verifyUnsubscribeToken(token, 'secret-two') === null);
check('tampered signature refused', verifyUnsubscribeToken(`${token.slice(0, -2)}xx`, 'secret-one') === null);
check('swapped user refused', verifyUnsubscribeToken(`${Buffer.from('other').toString('base64url')}.${token.split('.')[1]}`, 'secret-one') === null);
check('junk refused', verifyUnsubscribeToken('junk', 'secret-one') === null);
check('empty refused', verifyUnsubscribeToken('', 'secret-one') === null);
check('missing secret refused', verifyUnsubscribeToken(token, '') === null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx tsx src/lib/admin/__verify__/unsubscribe-token.verify.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

function sign(payload: string, secret: string): string {
  return createHmac('sha256', `unsubscribe:${secret}`).update(payload).digest('base64url');
}

export function signUnsubscribeToken(userId: string, secret: string): string {
  const payload = Buffer.from(userId).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the user id, or null for anything not signed with this secret. */
export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  if (!token || !secret) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  return Buffer.from(payload, 'base64url').toString();
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx tsx src/lib/admin/__verify__/unsubscribe-token.verify.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(email): add signed unsubscribe tokens"
```

## Task 20: Comms migration

**Files:**
- Create: `supabase/migrations/20261031000004_admin_comms.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Admin broadcasts and email opt-outs. Service-role-only. Unsubscribing needs
-- no login, so it is a route using a signed token, not an RLS policy.

CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  marketing_opt_out boolean NOT NULL DEFAULT false,
  opted_out_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  channels text[] NOT NULL,
  category text CHECK (category IN ('product', 'service')),
  audience jsonb NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON public.broadcasts (created_at DESC);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.email_preferences FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.broadcasts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.email_preferences TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.broadcasts TO service_role;

CREATE OR REPLACE FUNCTION public.admin_recipients(
  p_plan text DEFAULT NULL,
  p_user_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  email text,
  name text,
  email_confirmed boolean,
  banned boolean,
  opted_out boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    u.id,
    u.email::text,
    COALESCE(p.full_name, p.name),
    u.email_confirmed_at IS NOT NULL,
    COALESCE(u.banned_until > now(), false),
    COALESCE(e.marketing_opt_out, false)
  FROM auth.users u
  LEFT JOIN public.users p ON p.id = u.id
  LEFT JOIN public.subscriptions s ON s.user_id = u.id
  LEFT JOIN public.email_preferences e ON e.user_id = u.id
  WHERE (p_plan IS NULL OR COALESCE(s.plan_id::text, 'free') = p_plan)
    AND (p_user_ids IS NULL OR u.id = ANY (p_user_ids));
$$;

-- Workers finish in any order, so counts must increment in the database.
CREATE OR REPLACE FUNCTION public.admin_record_broadcast_result(
  p_broadcast uuid,
  p_sent integer,
  p_failed integer
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.broadcasts
     SET sent_count = sent_count + p_sent,
         failed_count = failed_count + p_failed
   WHERE id = p_broadcast;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_recipients(text, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_record_broadcast_result(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_recipients(text, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_record_broadcast_result(uuid, integer, integer) TO service_role;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20261031000004_admin_comms.sql
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(admin): add email preferences and broadcasts"
```

## Task 21: Unsubscribe page and route

**Files:**
- Create: `src/app/api/email/unsubscribe/route.ts`, `src/app/unsubscribe/page.tsx`, `src/components/unsubscribe-button.tsx`
- Modify: `src/lib/env.ts`, `.env.example`

- [ ] **Step 1: Declare the env vars**

Add `'EMAIL_UNSUBSCRIBE_SECRET'` and `'EMAIL_POSTAL_ADDRESS'` to the `optionalServerVars` array in `src/lib/env.ts`.

Add to `.env.example`:

```bash
# Signs unsubscribe links. Generate with: openssl rand -base64 32
EMAIL_UNSUBSCRIBE_SECRET=
# Physical mailing address shown in product update emails (street or PO box, not an email address)
EMAIL_POSTAL_ADDRESS=
```

- [ ] **Step 2: Write the route**

This handles both the page's button and mailbox one-click `List-Unsubscribe-Post`, so it reads the token from the query and ignores the body.

```ts
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/supabase/admin';
import { verifyUnsubscribeToken } from '@/lib/email-unsubscribe';

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const userId = verifyUnsubscribeToken(token, process.env.EMAIL_UNSUBSCRIBE_SECRET ?? '');
  if (!userId) return NextResponse.json({ error: 'Invalid link' }, { status: 400 });

  const { error } = await getSupabaseAdmin().from('email_preferences').upsert({
    user_id: userId,
    marketing_opt_out: true,
    opted_out_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: 'Could not unsubscribe' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Write the button**

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  async function unsubscribe() {
    setState('busy');
    const response = await fetch(`/api/email/unsubscribe?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => null);
    setState(response?.ok ? 'done' : 'error');
  }

  if (state === 'done') {
    return <p role="status">You are unsubscribed from product updates. You will still get essential account emails.</p>;
  }
  return (
    <div className="space-y-2">
      <Button disabled={state === 'busy'} onClick={unsubscribe}>Unsubscribe from product updates</Button>
      {state === 'error' && <p role="alert" className="text-sm text-rose-400">That did not work. Please try again.</p>}
    </div>
  );
}
```

- [ ] **Step 4: Write the page**

Opening the link changes nothing, because mail scanners open links.

```tsx
import { UnsubscribeButton } from '@/components/unsubscribe-button';
import { verifyUnsubscribeToken } from '@/lib/email-unsubscribe';

export const metadata = { title: 'Unsubscribe', robots: { index: false, follow: false } };

export default function UnsubscribePage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token ?? '';
  const valid = verifyUnsubscribeToken(token, process.env.EMAIL_UNSUBSCRIBE_SECRET ?? '') !== null;

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">Email preferences</h1>
        {valid ? (
          <UnsubscribeButton token={token} />
        ) : (
          <p className="text-white/60">This link is not valid. Email contact@cyberdelic.design and we will unsubscribe you.</p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no new errors.

```bash
git add src .env.example
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(email): add unsubscribe page and route"
```

## Task 22: Audience and content rules

**Files:**
- Create: `src/lib/admin/comms.ts`, `src/lib/admin/__verify__/broadcast-audience.verify.ts`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * Who a broadcast reaches, and that the test send matches the content sent.
 * Run: npx tsx src/lib/admin/__verify__/broadcast-audience.verify.ts
 */
import { filterRecipients, signContent, verifyContent, type RecipientRow } from '../comms';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗', name); }
}

const rows: RecipientRow[] = [
  { user_id: 'a', email: 'a@x.co', name: 'A', email_confirmed: true, banned: false, opted_out: false },
  { user_id: 'b', email: 'b@x.co', name: 'B', email_confirmed: true, banned: false, opted_out: true },
  { user_id: 'c', email: 'c@x.co', name: 'C', email_confirmed: true, banned: true, opted_out: false },
  { user_id: 'd', email: 'd@x.co', name: 'D', email_confirmed: false, banned: false, opted_out: false },
];

const ids = (list: RecipientRow[]) => list.map((r) => r.user_id).join();

const product = filterRecipients(rows, 'product');
check('product update skips opt-outs', ids(product.email) === 'a');
const service = filterRecipients(rows, 'service');
check('service notice reaches opt-outs', ids(service.email) === 'a,b');
check('suspended get nothing', !ids(product.inApp).includes('c') && !ids(service.email).includes('c'));
check('unconfirmed get no email', !ids(service.email).includes('d'));
check('in-app ignores email opt-out', ids(product.inApp) === 'a,b,d');

const content = { subject: 'Hello', body: 'World', category: 'product' as const };
const token = signContent(content, 'user-1', 'secret');
check('matching content verifies', verifyContent(token, content, 'user-1', 'secret'));
check('edited body refused', !verifyContent(token, { ...content, body: 'Changed' }, 'user-1', 'secret'));
check('edited category refused', !verifyContent(token, { ...content, category: 'service' }, 'user-1', 'secret'));
check('other sender refused', !verifyContent(token, content, 'user-2', 'secret'));
check('junk refused', !verifyContent('junk', content, 'user-1', 'secret'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx tsx src/lib/admin/__verify__/broadcast-audience.verify.ts`
Expected: FAIL, cannot find module `../comms`.

- [ ] **Step 3: Implement**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const CATEGORIES = ['product', 'service'] as const;
export type Category = (typeof CATEGORIES)[number];

export const audienceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({ kind: z.literal('plan'), plan: z.enum(['free', 'pro', 'lifetime', 'beta_tester']) }),
  z.object({ kind: z.literal('users'), userIds: z.array(z.string().uuid()).min(1).max(500) }),
]);
export type Audience = z.infer<typeof audienceSchema>;

export const contentSchema = z.object({
  channels: z.array(z.enum(['in_app', 'email'])).min(1),
  category: z.enum(CATEGORIES),
  audience: audienceSchema,
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
});

export interface RecipientRow {
  user_id: string;
  email: string;
  name: string | null;
  email_confirmed: boolean;
  banned: boolean;
  opted_out: boolean;
}

export function filterRecipients(rows: RecipientRow[], category: Category) {
  const active = rows.filter((row) => !row.banned);
  return {
    inApp: active,
    email: active.filter((row) => row.email_confirmed && (category === 'service' || !row.opted_out)),
  };
}

export interface SignedContent {
  subject: string;
  body: string;
  category: Category;
}

function contentHash(content: SignedContent, senderId: string, secret: string): string {
  return createHmac('sha256', `test-send:${secret}`)
    .update(JSON.stringify([senderId, content.category, content.subject, content.body]))
    .digest('base64url');
}

/** Proof that this sender test-sent exactly this content. */
export function signContent(content: SignedContent, senderId: string, secret: string): string {
  return contentHash(content, senderId, secret);
}

export function verifyContent(token: string, content: SignedContent, senderId: string, secret: string): boolean {
  const expected = Buffer.from(contentHash(content, senderId, secret));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx tsx src/lib/admin/__verify__/broadcast-audience.verify.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(admin): add audience filter and test-send proof"
```

## Task 23: Broadcast email template

**Files:**
- Modify: `emails/_components/email-layout.tsx`
- Create: `emails/broadcast.tsx`

- [ ] **Step 1: Add the postal address to the layout**

Add `postalAddress?: string;` to `EmailLayoutProps`, and `postalAddress,` to the destructured props. Directly after the `© ... Cyberdelic Labs` `Text`, add:

```tsx
            {postalAddress && (
              <Text style={{ color: '#6b6b7b', fontSize: '12px', fontFamily: FONT_FAMILY, margin: '0 0 8px' }}>
                {postalAddress}
              </Text>
            )}
```

- [ ] **Step 2: Write `emails/broadcast.tsx`**

```tsx
import { Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';

interface BroadcastProps {
  userName: string;
  subject: string;
  body: string;
  /** Product updates only. Service notices have no unsubscribe. */
  unsubscribeUrl?: string;
  postalAddress?: string;
}

export default function Broadcast({ userName, subject, body, unsubscribeUrl, postalAddress }: BroadcastProps) {
  return (
    <EmailLayout
      previewText={subject}
      showUnsubscribe={!!unsubscribeUrl}
      unsubscribeUrl={unsubscribeUrl}
      postalAddress={postalAddress}
    >
      <Section style={{ padding: '32px 40px' }}>
        <Heading style={{ color: '#edfcfc', fontSize: '24px', fontWeight: 600, margin: '0 0 20px' }}>{subject}</Heading>
        <Text style={{ color: '#a0a0b0', fontSize: '14px', margin: '0 0 16px' }}>Hi {userName},</Text>
        {body.split(/\n{2,}/).map((paragraph, index) => (
          <Text key={index} style={{ color: '#edfcfc', fontSize: '15px', lineHeight: '1.7', margin: '0 0 16px', whiteSpace: 'pre-wrap' as const }}>
            {paragraph}
          </Text>
        ))}
      </Section>
    </EmailLayout>
  );
}

Broadcast.PreviewProps = {
  userName: 'Alex',
  subject: 'A better way to share your canvas',
  body: 'Sharing is now one click.\n\nOpen any canvas to try it.',
  unsubscribeUrl: 'https://canvas.cyberdelic.design/unsubscribe?token=abc123',
  postalAddress: '123 Example Street, Example City',
} satisfies BroadcastProps;
```

- [ ] **Step 3: Commit**

```bash
git add emails
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(email): add broadcast template and postal address"
```

## Task 24: Comms routes

**Files:**
- Create: `src/lib/admin/broadcast.ts`, `src/app/api/admin/comms/preview/route.ts`, `.../test/route.ts`, `.../send/route.ts`

- [ ] **Step 1: Write the server helpers**

`src/lib/admin/broadcast.ts`:

```ts
import { getSupabaseAdmin } from '@/supabase/admin';
import { signUnsubscribeToken } from '@/lib/email-unsubscribe';
import { filterRecipients, type Audience, type Category, type RecipientRow } from './comms';

export async function resolveRecipients(audience: Audience, category: Category) {
  const { data, error } = await getSupabaseAdmin().rpc('admin_recipients', {
    p_plan: audience.kind === 'plan' ? audience.plan : null,
    p_user_ids: audience.kind === 'users' ? audience.userIds : null,
  });
  if (error) throw error;
  return filterRecipients((data ?? []) as RecipientRow[], category);
}

/** Why email of this category cannot go out, or null when it can. */
export function emailConfigProblem(category: Category): string | null {
  if (category !== 'product') return null;
  if (!process.env.EMAIL_UNSUBSCRIBE_SECRET) return 'Product updates need EMAIL_UNSUBSCRIBE_SECRET to be set.';
  if (!process.env.EMAIL_POSTAL_ADDRESS) return 'Product updates need EMAIL_POSTAL_ADDRESS to be set.';
  return null;
}

export function unsubscribeLinks(userId: string) {
  const token = signUnsubscribeToken(userId, process.env.EMAIL_UNSUBSCRIBE_SECRET ?? '');
  const base = process.env.NEXT_PUBLIC_APP_URL;
  return {
    pageUrl: `${base}/unsubscribe?token=${encodeURIComponent(token)}`,
    oneClickUrl: `${base}/api/email/unsubscribe?token=${encodeURIComponent(token)}`,
  };
}

export function testSecret(): string {
  return process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || '';
}
```

- [ ] **Step 2: Write the preview route**

```ts
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/admin/gate';
import { parseBody } from '@/lib/admin/http';
import { contentSchema } from '@/lib/admin/comms';
import { emailConfigProblem, resolveRecipients } from '@/lib/admin/broadcast';

export async function POST(request: Request) {
  const gate = await requirePermission('comms.send');
  if (!gate.ok) return gate.response;
  const body = await parseBody(request, contentSchema);
  if (!body.ok) return body.response;

  const recipients = await resolveRecipients(body.data.audience, body.data.category);
  const wantsEmail = body.data.channels.includes('email');
  return NextResponse.json({
    inAppCount: body.data.channels.includes('in_app') ? recipients.inApp.length : 0,
    emailCount: wantsEmail ? recipients.email.length : 0,
    problem: wantsEmail ? emailConfigProblem(body.data.category) : null,
  });
}
```

- [ ] **Step 3: Write the test-send route**

```ts
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/admin/gate';
import { parseBody } from '@/lib/admin/http';
import { contentSchema, signContent } from '@/lib/admin/comms';
import { emailConfigProblem, testSecret, unsubscribeLinks } from '@/lib/admin/broadcast';
import { enqueueEmail } from '@/lib/email-queue';
import Broadcast from '@emails/broadcast';

export async function POST(request: Request) {
  const gate = await requirePermission('comms.send');
  if (!gate.ok) return gate.response;
  const body = await parseBody(request, contentSchema);
  if (!body.ok) return body.response;
  const { subject, category } = body.data;
  const text = body.data.body;

  const problem = emailConfigProblem(category);
  if (problem) return NextResponse.json({ error: problem }, { status: 409 });

  await enqueueEmail({
    to: gate.staff.email,
    subject: `[Test] ${subject}`,
    template: Broadcast({
      userName: 'there',
      subject,
      body: text,
      unsubscribeUrl: category === 'product' ? unsubscribeLinks(gate.staff.userId).pageUrl : undefined,
      postalAddress: category === 'product' ? process.env.EMAIL_POSTAL_ADDRESS : undefined,
    }),
  });

  return NextResponse.json({
    ok: true,
    testToken: signContent({ subject, body: text, category }, gate.staff.userId, testSecret()),
  });
}
```

- [ ] **Step 4: Write the send route**

```ts
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { withAudit } from '@/lib/admin/audit';
import { parseBody } from '@/lib/admin/http';
import { contentSchema, verifyContent } from '@/lib/admin/comms';
import { emailConfigProblem, resolveRecipients, testSecret, unsubscribeLinks } from '@/lib/admin/broadcast';
import { enqueueEmail } from '@/lib/email-queue';
import Broadcast from '@emails/broadcast';

const NOTIFICATION_CHUNK = 500;
const EMAIL_CHUNK = 25;

const schema = contentSchema.extend({
  confirmCount: z.number().int().optional(),
  testToken: z.string().optional(),
});

export async function POST(request: Request) {
  const gate = await requirePermission('comms.send');
  if (!gate.ok) return gate.response;
  const parsed = await parseBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const { channels, category, audience, subject, body, confirmCount, testToken } = parsed.data;

  const wantsEmail = channels.includes('email');
  const wantsInApp = channels.includes('in_app');
  const recipients = await resolveRecipients(audience, category);

  if (wantsEmail) {
    const problem = emailConfigProblem(category);
    if (problem) return NextResponse.json({ error: problem }, { status: 409 });
    if (!testToken || !verifyContent(testToken, { subject, body, category }, gate.staff.userId, testSecret())) {
      return NextResponse.json({ error: 'Send yourself a test of this exact content first.' }, { status: 409 });
    }
    if (confirmCount !== recipients.email.length) {
      return NextResponse.json({ error: 'The recipient count changed or does not match. Check it and confirm again.' }, { status: 409 });
    }
  }

  const admin = getSupabaseAdmin();
  const recipientCount = wantsEmail ? recipients.email.length : recipients.inApp.length;
  const { data: broadcast, error: createError } = await admin
    .from('broadcasts')
    .insert({
      sender_id: gate.staff.userId,
      channels,
      category: wantsEmail ? category : null,
      audience,
      subject,
      body,
      recipient_count: recipientCount,
    })
    .select('id')
    .single();
  if (createError || !broadcast) {
    return NextResponse.json({ error: 'Nothing was sent.' }, { status: 500 });
  }
  const broadcastId = broadcast.id as string;

  try {
    await withAudit(
      {
        actorId: gate.staff.userId,
        action: 'broadcast.send',
        targetType: 'broadcast',
        targetId: broadcastId,
        after: { channels, category, audience, subject, recipientCount },
      },
      async () => {
        if (wantsInApp) {
          for (let i = 0; i < recipients.inApp.length; i += NOTIFICATION_CHUNK) {
            const rows = recipients.inApp.slice(i, i + NOTIFICATION_CHUNK).map((row) => ({
              user_id: row.user_id,
              title: subject,
              message: body,
              type: 'announcement',
              is_global: false,
              metadata: { broadcastId },
            }));
            const { error } = await admin.from('notifications').insert(rows);
            if (error) throw error;
          }
        }

        if (wantsEmail) {
          const postalAddress = category === 'product' ? process.env.EMAIL_POSTAL_ADDRESS : undefined;
          for (let i = 0; i < recipients.email.length; i += EMAIL_CHUNK) {
            await Promise.all(
              recipients.email.slice(i, i + EMAIL_CHUNK).map((row) => {
                const links = category === 'product' ? unsubscribeLinks(row.user_id) : null;
                return enqueueEmail({
                  to: row.email,
                  subject,
                  userId: row.user_id,
                  emailKind: `broadcast-${broadcastId}`,
                  broadcastId,
                  // The direct fallback skips the worker's duplicate check and result count.
                  fallbackOnMissing: false,
                  headers: links
                    ? {
                        'List-Unsubscribe': `<${links.oneClickUrl}>`,
                        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                      }
                    : undefined,
                  template: Broadcast({
                    userName: row.name || 'there',
                    subject,
                    body,
                    unsubscribeUrl: links?.pageUrl,
                    postalAddress,
                  }),
                });
              }),
            );
          }
        }
      },
    );
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'admin-comms-send' }, extra: { broadcastId } });
    return NextResponse.json(
      { error: 'The send stopped partway. Check the history before trying again.', broadcastId },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, broadcastId, recipientCount });
}
```

- [ ] **Step 5: Check routes and commit**

Run: `npx tsx src/lib/admin/__verify__/admin-routes.verify.ts`
Expected: `11 handlers checked`, exit 0.

Run: `npx tsc --noEmit`
Expected: no new errors.

```bash
git add src
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(admin): add broadcast preview, test and send routes"
```

## Task 25: Composer page

**Files:**
- Create: `src/components/admin/composer.tsx`, `src/app/admin/comms/page.tsx`

- [ ] **Step 1: Write the composer**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { adminPost } from '@/lib/admin/client';

const FIELD = 'h-9 w-full rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Preview {
  inAppCount: number;
  emailCount: number;
  problem: string | null;
}

export function Composer() {
  const router = useRouter();
  const [inApp, setInApp] = useState(true);
  const [email, setEmail] = useState(false);
  const [category, setCategory] = useState<'product' | 'service'>('product');
  const [audienceKind, setAudienceKind] = useState<'all' | 'plan' | 'users'>('all');
  const [plan, setPlan] = useState('free');
  const [userIds, setUserIds] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [testToken, setTestToken] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const payload = useMemo(() => {
    const ids = userIds.split(/[\s,]+/).filter((value) => UUID.test(value));
    const audience =
      audienceKind === 'plan' ? { kind: 'plan', plan }
      : audienceKind === 'users' ? { kind: 'users', userIds: ids }
      : { kind: 'all' };
    return {
      channels: [...(inApp ? ['in_app'] : []), ...(email ? ['email'] : [])],
      category,
      audience,
      subject: subject.trim(),
      body: body.trim(),
    };
  }, [inApp, email, category, audienceKind, plan, userIds, subject, body]);

  function changed() {
    setPreview(null);
    setTestToken('');
    setConfirmText('');
    setMessage(null);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const ready = payload.channels.length > 0 && !!payload.subject && !!payload.body;
  const count = preview?.emailCount ?? 0;
  const canSend =
    !!preview && !preview.problem && (!email || (!!testToken && confirmText === String(count)));

  return (
    <div className="space-y-4 rounded-lg border border-white/10 p-4">
      <fieldset className="flex gap-4 text-sm">
        <legend className="mb-1 text-white/60">Channel</legend>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={inApp} onChange={(e) => { setInApp(e.target.checked); changed(); }} /> In-app
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={email} onChange={(e) => { setEmail(e.target.checked); changed(); }} /> Email
        </label>
      </fieldset>

      {email && (
        <div className="space-y-1">
          <label htmlFor="category" className="text-sm text-white/60">Email category</label>
          <select id="category" className={FIELD} value={category} onChange={(e) => { setCategory(e.target.value as 'product' | 'service'); changed(); }}>
            <option value="product">Product update (skips unsubscribed users)</option>
            <option value="service">Service notice (reaches everyone)</option>
          </select>
          {category === 'service' && (
            <p className="text-xs text-amber-300">Essential messages only, such as an outage or terms change. Never use this to promote anything.</p>
          )}
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="audience" className="text-sm text-white/60">Audience</label>
        <select id="audience" className={FIELD} value={audienceKind} onChange={(e) => { setAudienceKind(e.target.value as 'all' | 'plan' | 'users'); changed(); }}>
          <option value="all">Everyone</option>
          <option value="plan">One plan</option>
          <option value="users">Chosen users</option>
        </select>
        {audienceKind === 'plan' && (
          <select aria-label="Plan" className={FIELD} value={plan} onChange={(e) => { setPlan(e.target.value); changed(); }}>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="lifetime">Lifetime</option>
            <option value="beta_tester">Beta tester</option>
          </select>
        )}
        {audienceKind === 'users' && (
          <Textarea
            aria-label="User IDs"
            placeholder="Paste user IDs from their user pages, separated by spaces or commas"
            value={userIds}
            onChange={(e) => { setUserIds(e.target.value); changed(); }}
            className="bg-white/5 border-white/10"
          />
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="subject" className="text-sm text-white/60">Subject</label>
        <input id="subject" className={FIELD} value={subject} onChange={(e) => { setSubject(e.target.value); changed(); }} />
      </div>
      <div className="space-y-1">
        <label htmlFor="body" className="text-sm text-white/60">Message (blank line starts a new paragraph)</label>
        <Textarea id="body" className="bg-white/5 border-white/10 min-h-40" value={body} onChange={(e) => { setBody(e.target.value); changed(); }} />
      </div>

      <Button
        size="sm"
        variant="outline"
        disabled={busy || !ready}
        onClick={() => run(async () => setPreview(await adminPost<Preview>('/api/admin/comms/preview', payload)))}
      >
        Check recipients
      </Button>

      {preview && (
        <div className="space-y-3 rounded-md bg-white/[0.03] p-3 text-sm">
          <p>{inApp ? `${preview.inAppCount} in-app` : ''}{inApp && email ? ' · ' : ''}{email ? `${preview.emailCount} emails` : ''}</p>
          {preview.problem && <p role="alert" className="text-rose-400">{preview.problem}</p>}
          {email && !preview.problem && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => run(async () => {
                  const result = await adminPost<{ testToken: string }>('/api/admin/comms/test', payload);
                  setTestToken(result.testToken);
                  setMessage({ ok: true, text: 'Test sent to your own email.' });
                })}
              >
                {testToken ? 'Send another test' : 'Send test to myself'}
              </Button>
              {testToken && (
                <div className="space-y-1">
                  <label htmlFor="confirm" className="text-white/60">Type {count} to confirm. A sent email cannot be recalled.</label>
                  <input id="confirm" inputMode="numeric" className={FIELD} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
                </div>
              )}
            </>
          )}
          <Button
            size="sm"
            disabled={busy || !canSend}
            onClick={() => run(async () => {
              await adminPost('/api/admin/comms/send', { ...payload, confirmCount: email ? count : undefined, testToken: testToken || undefined });
              changed();
              setSubject('');
              setBody('');
              setMessage({ ok: true, text: 'Sent. Delivery counts update in the history below.' });
              router.refresh();
            })}
          >
            Send
          </Button>
        </div>
      )}

      {message && <p role="status" className={`text-sm ${message.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{message.text}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

```tsx
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePagePermission } from '@/lib/admin/gate';
import { formatDate } from '@/lib/admin/users';
import { Composer } from '@/components/admin/composer';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default async function AdminCommsPage() {
  await requirePagePermission('comms.send');
  const { data } = await getSupabaseAdmin()
    .from('broadcasts')
    .select('id, subject, channels, category, recipient_count, sent_count, failed_count, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Comms</h1>
      <Composer />
      <section className="space-y-2">
        <h2 className="font-medium">History</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sent</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Emails delivered</TableHead>
              <TableHead>Failed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatDate(row.created_at)}</TableCell>
                <TableCell>{row.subject}</TableCell>
                <TableCell>{(row.channels as string[]).join(', ')}</TableCell>
                <TableCell>{row.recipient_count}</TableCell>
                <TableCell>{row.sent_count}</TableCell>
                <TableCell>{row.failed_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length === 0 && <p className="text-sm text-white/50">Nothing sent yet.</p>}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no new errors.

```bash
git add src
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "feat(admin): add comms composer and history"
```

## Task 26: Notification cleanup

**Files:**
- Modify: `src/hooks/use-notifications.ts:35-58`, `src/lib/notifications.ts`, `docs/notifications-guide.md`
- Delete: `supabase/functions/push-notification/`

- [ ] **Step 1: Filter the realtime subscription**

Replace the realtime effect in `use-notifications.ts`:

```ts
  // Subscribe to realtime updates
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;
      channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            // Reload notifications when any change occurs
            loadNotifications();
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadNotifications]);
```

Postgres changes cannot filter DELETE events, so clearing on one device no longer updates another open device until its next reload. That is acceptable: the clearing device already updates its own state.

- [ ] **Step 2: Remove the broken global path**

Delete `createGlobalAnnouncement` from `src/lib/notifications.ts`, including its doc comment, up to its closing brace. Run `grep -n createGlobalAnnouncement -r src`; expected: no output.

- [ ] **Step 3: Update the guide**

The owner decided on 2026-10-31 to keep the live `supabase-functions-push-notification` function for now, so leave `supabase/functions/push-notification/` and its curl example in place.

In `docs/notifications-guide.md`, delete the section that shows `createGlobalAnnouncement` (around line 268). Add in its place:

```markdown
## Sending announcements

Send announcements from the admin console at `/admin/comms`. It writes one notification per recipient, so each user has their own read state. `is_global` rows are not visible under the current RLS policies.
```

- [ ] **Step 4: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no new errors.

```bash
git add -A src docs/notifications-guide.md
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "fix(notifications): filter realtime by user and remove global path"
```

---

# Phase 5: Verification

## Task 27: Full verification and handoff

- [ ] **Step 1: Run every verify script**

```bash
npx tsx src/lib/admin/__verify__/admin-roles.verify.ts
npx tsx src/lib/admin/__verify__/admin-routes.verify.ts
npx tsx src/lib/admin/__verify__/admin-plan-guard.verify.ts
npx tsx src/lib/admin/__verify__/admin-tickets.verify.ts
npx tsx src/lib/admin/__verify__/unsubscribe-token.verify.ts
npx tsx src/lib/admin/__verify__/broadcast-audience.verify.ts
```

Expected: all exit 0, and `admin-routes` reports `11 handlers checked`.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: succeeds, with all `/admin` routes listed.

- [ ] **Step 3: Note the convention in `CLAUDE.md`**

In `CLAUDE.md`, add one line under the working conventions: `Admin console: /admin. Roles in staff_roles; every /api/admin handler starts with requirePermission (checked by src/lib/admin/__verify__/admin-routes.verify.ts).`

```bash
git add CLAUDE.md
git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "docs: note admin console conventions"
```

- [ ] **Step 4: Stop and hand off**

Do not continue past this step without the owner. Report results and this checklist:

1. Remind the owner that the live `supabase-functions-push-notification` edge function is still open, by their decision on 2026-10-31. Do not delete it without a new instruction.
2. Approve applying the four migrations, in order, to `sstllhsrmcvijyokykwp`. After applying, run this and expect one row with role `owner`: `select user_id, role from public.staff_roles;`
3. Rollback smoke test of the RPCs, because triggers on `subscriptions` run under an empty `search_path`:

```sql
BEGIN;
SELECT public.admin_set_plan(
  '322d15dd-8477-41ff-8980-f344fda14164',
  (SELECT user_id FROM public.subscriptions
    WHERE plan_id = 'free' AND stripe_subscription_id IS NULL AND plan_source IS NULL LIMIT 1),
  'beta_tester', 'smoke test');
ROLLBACK;
```

4. Set `EMAIL_UNSUBSCRIBE_SECRET` in Vercel. Set `EMAIL_POSTAL_ADDRESS` once a physical address is available; until then, product updates are refused and service notices work.
5. Browser test on a preview deployment as signed-out, member, Staff, Admin and Owner, using test accounts. Confirm non-staff get 404 at `/admin` and 403 on `/api/admin/*`. Confirm a suspended test account: note whether its open session ends at once or at token expiry, and that Nexus sign-in is refused. Confirm an admin-sent password reset works from a different browser than the admin's. Test sends go to the sender only. No broadcast reaches real users during testing.
6. Merge when the owner approves.
