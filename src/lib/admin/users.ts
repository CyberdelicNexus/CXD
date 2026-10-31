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

/** `includeAudit` is false for roles without audit.view, so their page never receives the history. */
export async function getUserDetail(id: string, options: { includeAudit: boolean }): Promise<AdminUserDetail | null> {
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
    options.includeAudit
      ? admin
          .from('admin_audit_log')
          .select('id, action, outcome, reason, created_at')
          .eq('target_type', 'user')
          .eq('target_id', id)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as AdminUserDetail['audit'] }),
  ]);

  return {
    id,
    email: user.email ?? '',
    name: profile.data?.full_name ?? profile.data?.name ?? null,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    bannedUntil: user.banned_until ?? null,
    role: isStaffRole(role.data?.role) ? role.data.role : null,
    subscription: subscription.data ?? null,
    credits: credits.data ?? null,
    canvasCount: canvases.count ?? 0,
    nexusMemberId: nexus.data?.member_id ?? null,
    audit: audit.data ?? [],
  };
}

/** Throws when the lookup fails: callers must treat that as "unknown", never as "no role". */
export async function getTargetRole(id: string): Promise<StaffRole | null> {
  const { data, error } = await getSupabaseAdmin().from('staff_roles').select('role').eq('user_id', id).maybeSingle();
  if (error) throw error;
  return isStaffRole(data?.role) ? data.role : null;
}

export function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toISOString().slice(0, 10) : '—';
}
