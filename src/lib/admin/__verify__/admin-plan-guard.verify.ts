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
