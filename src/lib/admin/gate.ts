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
  if (isBanned(user.banned_until, new Date())) {
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
