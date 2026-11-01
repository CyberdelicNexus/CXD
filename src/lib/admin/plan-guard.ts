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
