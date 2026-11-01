# Admin Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/admin` into a home dashboard showing what needs attention, business health, product usage and system health.

**Architecture:** Pure calculations live in `metrics.ts`. One reader per source lives in `sources.ts`, cached for 5 minutes, and a failed source shows "Unavailable" on its own panels. A nightly cron saves the numbers that cannot be rebuilt later.

**Tech Stack:** Next.js 14 App Router, Supabase, Stripe 17, recharts 2, `@vercel/analytics`.

**Spec:** `docs/superpowers/specs/2026-11-01-admin-analytics-design.md`

---

## Ground rules

- Work only in `C:\Users\JEMA\Documents\ClaudeCode\CXD\CXD-admin`, branch `feat/admin-analytics`.
- Commit with `git -c user.name="Jose" -c user.email="connect@cyberdelic.nexus" commit -m "..."`. Never add `Co-Authored-By`. Do not push.
- `docs/superpowers/` is gitignored but tracked, so use `git add -f` there.
- Run verify scripts from the repo root with `npx --yes tsx <path>`.
- `npx tsc --noEmit` has a 58-error baseline in test files. Only new errors count. `npm run build` is the real gate.
- **Never apply a migration, set an env var, deploy, or call Stripe or Vercel with real credentials while executing this plan.**
- Every `src/app/admin/**/page.tsx` must call `requirePagePermission`; `admin-routes.verify.ts` enforces it.

## File map

```
supabase/migrations/20261101000001_admin_analytics.sql   snapshot table and summary RPCs
src/lib/admin/analytics/metrics.ts                       pure calculations
src/lib/admin/analytics/sources.ts                       one reader per source, cached
src/lib/admin/__verify__/admin-analytics.verify.ts       tests for metrics.ts
src/app/api/cron/admin-metrics/route.ts                  nightly snapshot
src/components/admin/dashboard/panels.tsx                server panels
src/components/admin/dashboard/trend-chart.tsx           client chart
src/app/admin/page.tsx                                   the dashboard
```

## Task 0: Baseline

- [ ] Run `npm ci`, then `npm run build`. Expected: succeeds. If it fails, stop and report, because the failure predates this work.

## Task 1: `analytics.view` permission

**Files:** Modify `src/lib/admin/permissions.ts`, `src/lib/admin/__verify__/admin-roles.verify.ts`

- [ ] **Step 1: Update the test.** In `admin-roles.verify.ts`, change the `admin:` line of `EXPECTED` to:

```ts
  admin: ['users.view', 'tickets.work', 'errors.view', 'users.edit', 'comms.send', 'audit.view', 'analytics.view'],
```

- [ ] **Step 2: Run it.** `npx --yes tsx src/lib/admin/__verify__/admin-roles.verify.ts`. Expected: fails, because `'analytics.view'` is unknown to `PERMISSIONS`.

- [ ] **Step 3: Implement.** In `permissions.ts`, add `'analytics.view',` to `PERMISSIONS` before `'roles.assign'`, and add to `ALLOWED`:

```ts
  'analytics.view': ['admin', 'owner'],
```

- [ ] **Step 4: Run it again.** Expected: 0 failed.

- [ ] **Step 5: Commit.** Message: `feat(admin): add analytics.view permission`.

## Task 2: Pure calculations

**Files:** Create `src/lib/admin/analytics/metrics.ts`, `src/lib/admin/__verify__/admin-analytics.verify.ts`

- [ ] **Step 1: Write the failing test.**

```ts
/**
 * Dashboard calculations.
 * Run: npx --yes tsx src/lib/admin/__verify__/admin-analytics.verify.ts
 */
import {
  classifyUsers,
  countsAsNewSubscriber,
  fillDays,
  dayList,
  planMix,
  toMajorUnits,
  computeMrr,
  computeRevenue,
  formatMoney,
  isAllClear,
  parseRange,
  parseVisitors,
  type SubscriptionInput,
} from '../analytics/metrics';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗', name); }
}

const line = (over: Partial<SubscriptionInput['items'][number]> = {}) => ({
  unitAmount: 1000, currency: 'usd', interval: 'month' as const, intervalCount: 1, quantity: 1, usageType: 'licensed' as const, ...over,
});
const sub = (status: string, ...items: SubscriptionInput['items']): SubscriptionInput => ({ status, items });

check('monthly', computeMrr([sub('active', line())]).usd === 1000);
check('yearly divides by 12', computeMrr([sub('active', line({ unitAmount: 12000, interval: 'year' }))]).usd === 1000);
check('weekly', computeMrr([sub('active', line({ interval: 'week' }))]).usd === 4333);
check('quarterly via interval count', computeMrr([sub('active', line({ unitAmount: 3000, intervalCount: 3 }))]).usd === 1000);
check('quantity applies', computeMrr([sub('active', line({ quantity: 3 }))]).usd === 3000);
check('trial excluded', Object.keys(computeMrr([sub('trialing', line())])).length === 0);
check('past due excluded', Object.keys(computeMrr([sub('past_due', line())])).length === 0);
check('canceled excluded', Object.keys(computeMrr([sub('canceled', line())])).length === 0);
check('null price skipped', Object.keys(computeMrr([sub('active', line({ unitAmount: null }))])).length === 0);
const mixed = computeMrr([sub('active', line()), sub('active', line({ currency: 'eur', unitAmount: 500 }))]);
check('currencies stay separate', mixed.usd === 1000 && mixed.eur === 500);
check('metered price skipped', Object.keys(computeMrr([sub('active', line({ usageType: 'metered' }))])).length === 0);
check('no subscriptions is empty', Object.keys(computeMrr([])).length === 0);

const revenue = computeRevenue([
  { amount: 5000, amountRefunded: 1000, currency: 'usd', status: 'succeeded' },
  { amount: 2000, amountRefunded: 0, currency: 'usd', status: 'failed' },
  { amount: 700, amountRefunded: 0, currency: 'eur', status: 'succeeded' },
]);
check('revenue minus refunds', revenue.usd === 4000);
check('failed charges ignored', revenue.usd !== 6000);
check('revenue by currency', revenue.eur === 700);

check('valid range', parseRange('90') === 90);
check('bad range falls back', parseRange('12') === 30);
check('missing range falls back', parseRange(undefined) === 30);

const row = (plan_id: string, status: string, has_stripe_subscription: boolean, plan_source: string | null, n: number) =>
  ({ plan_id, status, has_stripe_subscription, plan_source, n });
const mix = classifyUsers(
  [
    row('pro', 'active', true, 'stripe', 2),
    row('lifetime', 'active', false, null, 1),
    row('lifetime', 'active', false, 'nexus', 1),
    row('beta_tester', 'active', false, null, 24),
    row('pro', 'active', false, 'nexus', 2),
    row('pro', 'active', false, 'admin', 1),
    row('pro', 'canceled', true, 'stripe', 1),
    row('free', 'active', false, null, 5),
  ],
  45,
);
check('paying counts live Stripe and owned lifetime', mix.paying === 3);
check('no trialing in this mix', mix.trialing === 0);
check('comped never counts as paying', mix.comped === 28);
check('a canceled Stripe row is not comped', mix.comped === 28);
const mix2 = classifyUsers(
  [
    row('lifetime', 'active', false, 'stripe', 2),
    row('pro', 'past_due', true, 'stripe', 1),
    row('pro', 'trialing', true, 'stripe', 3),
    row('pro', 'active', true, 'stripe', 1),
    row('free', 'active', false, null, 4),
  ],
  20,
);
check('lifetime bought through Stripe is paying', mix2.paying === 4);
check('past due still pays', mix2.paying === 4 && mix2.comped === 0);
check('trialing counted apart', mix2.trialing === 3);
check('trialing is not comped', mix2.comped === 0);
check('free excludes trialing', mix2.free === 13);

check('free includes users with no subscription row', mix.free === 14);

const mix3 = classifyUsers(
  [
    row('pro', 'unpaid', true, 'stripe', 2),
    row('pro', 'paused', true, 'stripe', 1),
    row('pro', 'incomplete', true, null, 1),
    row('pro', 'active', false, 'admin', 1),
    row('pro', 'active', false, 'nexus', 1),
  ],
  10,
);
check('unpaid and paused are not comped', mix3.comped === 2);
check('lapsed Stripe customers fall into free', mix3.paying === 0 && mix3.free === 8);

const clear = { openTickets: 0, highPriorityTickets: 0, unresolvedErrors: 0, failedPayments: 0, failedEmails: 0 };
check('all zero is clear', isAllClear({ ok: true, data: clear }));
check('any count is not clear', !isAllClear({ ok: true, data: { ...clear, failedEmails: 1 } }));
check('a failed source is never clear', !isAllClear({ ok: false }));

check('visitors in object', parseVisitors({ data: { visitors: 12 } }) === 12);
check('visitors in array', parseVisitors({ data: [{ visitors: 7 }] }) === 7);
check('unknown shape is null', parseVisitors({ data: { visitors: 'many' } }) === null);
check('empty body is null', parseVisitors(null) === null);

check('money in jpy has no minor unit', formatMoney(1500, 'jpy').includes('1,500') && !formatMoney(1500, 'jpy').includes('.'));
check('zero-decimal major units', toMajorUnits(1500, 'jpy') === 1500 && toMajorUnits(1500, 'usd') === 15);
check('new subscriber excludes incomplete', !countsAsNewSubscriber('incomplete') && !countsAsNewSubscriber('incomplete_expired'));
check('new subscriber includes trials', countsAsNewSubscriber('trialing') && countsAsNewSubscriber('active'));

const mixOrder = planMix([row('free', 'active', false, null, 2), row('pro', 'active', true, 'stripe', 5), row('pro', 'canceled', true, 'stripe', 1)]);
check('plan mix groups and sorts', mixOrder[0].plan === 'pro' && mixOrder[0].n === 6 && mixOrder[1].plan === 'free');

const now = new Date('2026-11-05T10:00:00Z');
check('day list is oldest first and ends today', dayList(3, now).join() === '2026-11-03,2026-11-04,2026-11-05');
const filled = fillDays([{ day: '2026-11-03', v: 1 }, { day: '2026-11-05', v: 3 }], 3, now);
check('missed night is a gap', filled.length === 3 && filled[1].row === null);
check('real rows kept in place', filled[0].row?.v === 1 && filled[2].row?.v === 3);
check('rows outside the range are dropped', fillDays([{ day: '2026-10-01', v: 9 }], 3, now).every((entry) => entry.row === null));
check('month boundary', dayList(3, new Date('2026-12-01T00:00:00Z')).join() === '2026-11-29,2026-11-30,2026-12-01');

check('money', formatMoney(123456, 'usd').includes('1,234.56'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run it.** Expected: fails, cannot find module.

- [ ] **Step 3: Implement `metrics.ts`.**

```ts
/** Dashboard calculations. Pure, so they can be verified without a request. */

export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];

export function parseRange(value: unknown): Range {
  const n = Number(value);
  return (RANGES as readonly number[]).includes(n) ? (n as Range) : 30;
}

/** A failed source stays distinct from a zero, so a panel can say "Unavailable". */
export type SourceResult<T> = { ok: true; data: T } | { ok: false };

export type CurrencyTotals = Record<string, number>;

export interface SubscriptionInput {
  status: string;
  items: {
    unitAmount: number | null;
    currency: string;
    interval: 'day' | 'week' | 'month' | 'year';
    intervalCount: number;
    quantity: number;
    /** Metered prices have no fixed amount per period, so they are skipped. */
    usageType: 'licensed' | 'metered';
  }[];
}

const INTERVALS_PER_MONTH = { day: 365 / 12, week: 52 / 12, month: 1, year: 1 / 12 };

/** Stripe's zero-decimal currencies: the amount is already in whole units. */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

/** Converts Stripe's smallest unit to the whole unit for display and charts. */
export function toMajorUnits(amount: number, currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase()) ? amount : amount / 100;
}

/** List price of active subscriptions: trials, past-due and discounts are not counted. */
export function computeMrr(subscriptions: SubscriptionInput[]): CurrencyTotals {
  const totals: CurrencyTotals = {};
  for (const subscription of subscriptions) {
    if (subscription.status !== 'active') continue;
    for (const item of subscription.items) {
      if (item.unitAmount == null || item.usageType === 'metered') continue;
      const monthly = (item.unitAmount * item.quantity * INTERVALS_PER_MONTH[item.interval]) / item.intervalCount;
      totals[item.currency] = (totals[item.currency] ?? 0) + monthly;
    }
  }
  for (const currency of Object.keys(totals)) totals[currency] = Math.round(totals[currency]);
  return totals;
}

export interface ChargeInput {
  amount: number;
  amountRefunded: number;
  currency: string;
  status: string;
}

export function computeRevenue(charges: ChargeInput[]): CurrencyTotals {
  const totals: CurrencyTotals = {};
  for (const charge of charges) {
    if (charge.status !== 'succeeded') continue;
    totals[charge.currency] = (totals[charge.currency] ?? 0) + charge.amount - charge.amountRefunded;
  }
  return totals;
}

export interface PlanRow {
  plan_id: string;
  status: string;
  has_stripe_subscription: boolean;
  plan_source: string | null;
  n: number;
}

const PAYING_STATUSES = ['active', 'past_due'];

function isPaying(row: PlanRow): boolean {
  if (row.has_stripe_subscription && PAYING_STATUSES.includes(row.status)) return true;
  // The checkout webhook sets plan_source 'stripe' on lifetime purchases.
  return row.plan_id === 'lifetime' && (row.plan_source === null || row.plan_source === 'stripe');
}

/** Comped: a non-free plan granted without Stripe, or by Nexus or an admin. A lapsed Stripe customer is neither paying nor comped. */
function isComped(row: PlanRow): boolean {
  if (row.plan_id === 'free') return false;
  return !row.has_stripe_subscription || row.plan_source === 'nexus' || row.plan_source === 'admin';
}

function isTrialing(row: PlanRow): boolean {
  return row.has_stripe_subscription && row.status === 'trialing';
}

/**
 * Comped is a non-free plan nobody pays for by design, so beta testers never read as revenue.
 * Lapsed Stripe customers (canceled, unpaid, paused, incomplete) fall into the free remainder.
 * Trialing Stripe subscriptions are counted apart: not yet paying, and not comped.
 */
export function classifyUsers(rows: PlanRow[], totalUsers: number) {
  let paying = 0;
  let trialing = 0;
  let comped = 0;
  for (const row of rows) {
    if (isPaying(row)) paying += row.n;
    else if (isTrialing(row)) trialing += row.n;
    else if (isComped(row)) comped += row.n;
  }
  return { paying, trialing, comped, free: Math.max(totalUsers - paying - trialing - comped, 0) };
}

/** Plan mix for display: rows grouped by plan, largest first. */
export function planMix(rows: PlanRow[]): { plan: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.plan_id, (counts.get(row.plan_id) ?? 0) + row.n);
  return Array.from(counts.entries()).map(([plan, n]) => ({ plan, n })).sort((a, b) => b.n - a.n);
}

/** UTC dates (YYYY-MM-DD) for the last `days` days, oldest first, ending today. */
export function dayList(days: number, now: Date): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

/** One entry per day in the range; a night with no snapshot has `row: null`, so a chart shows a gap. */
export function fillDays<T extends { day: string }>(rows: T[], days: number, now: Date): { day: string; row: T | null }[] {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  return dayList(days, now).map((day) => ({ day, row: byDay.get(day) ?? null }));
}

/** A new subscriber is anyone whose subscription got past checkout. */
export function countsAsNewSubscriber(status: string): boolean {
  return status !== 'incomplete' && status !== 'incomplete_expired';
}

export interface AttentionCounts {
  openTickets: number;
  highPriorityTickets: number;
  unresolvedErrors: number;
  failedPayments: number;
  failedEmails: number;
}

export function isAllClear(result: SourceResult<AttentionCounts>): boolean {
  if (!result.ok) return false;
  const { openTickets, unresolvedErrors, failedPayments, failedEmails } = result.data;
  return openTickets + unresolvedErrors + failedPayments + failedEmails === 0;
}

/** The docs show two response shapes, so anything else counts as unavailable. */
export function parseVisitors(body: unknown): number | null {
  const data = (body as { data?: unknown } | null)?.data;
  const row = Array.isArray(data) ? data[0] : data;
  const visitors = (row as { visitors?: unknown } | null | undefined)?.visitors;
  return typeof visitors === 'number' ? visitors : null;
}

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
    toMajorUnits(cents, currency),
  );
}
```

- [ ] **Step 4: Run it.** Expected: 0 failed (the blocks above are the reviewed final version). The weekly case is `1000 * 52 / 12 = 4333.33`, rounded to 4333.

- [ ] **Step 5: Commit.** Message: `feat(admin): add dashboard calculations`.

## Task 3: Migration

**Files:** Create `supabase/migrations/20261101000001_admin_analytics.sql`. Do not apply it.

- [ ] **Step 1: Write it.**

```sql
-- Admin dashboard. Service-role-only.
--
-- admin_daily_metrics holds what cannot be rebuilt later: auth.users keeps only
-- the last sign-in, Stripe has no past MRR, and credit usage resets each period.

CREATE TABLE IF NOT EXISTS public.admin_daily_metrics (
  day date PRIMARY KEY,
  active_7d integer NOT NULL,
  active_30d integer NOT NULL,
  -- Null when Stripe could not be read, so a chart shows a gap and not a false zero.
  mrr_cents jsonb,
  paying_users integer NOT NULL,
  comped_users integer NOT NULL,
  free_users integer NOT NULL,
  credits_used_period integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_daily_metrics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_daily_metrics FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.admin_daily_metrics TO service_role;

CREATE OR REPLACE FUNCTION public.admin_attention_summary(p_days integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'openTickets', (SELECT count(*) FROM public.support_tickets WHERE status <> 'done'),
    'highPriorityTickets', (SELECT count(*) FROM public.support_tickets WHERE status <> 'done' AND priority = 'high'),
    'unresolvedErrors', (SELECT count(*) FROM public.fix_pipeline WHERE decision IS NULL),
    'failedPayments', (SELECT count(*) FROM public.subscriptions WHERE status::text IN ('past_due', 'unpaid')),
    'failedEmails',
      (SELECT COALESCE(sum(failed_count), 0) FROM public.broadcasts WHERE created_at >= now() - make_interval(days => p_days))
      + (SELECT count(*) FROM public.support_ticket_events WHERE kind = 'delivery_failed' AND created_at >= now() - make_interval(days => p_days))
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_analytics_summary(p_days integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH days AS (
    SELECT generate_series(
      (now() AT TIME ZONE 'utc')::date - (p_days - 1),
      (now() AT TIME ZONE 'utc')::date,
      interval '1 day'
    )::date AS day
  ),
  signups AS (
    SELECT (created_at AT TIME ZONE 'utc')::date AS day, count(*) AS n FROM auth.users GROUP BY 1
  ),
  canvases AS (
    SELECT (created_at AT TIME ZONE 'utc')::date AS day, count(*) AS n FROM public.cxd_projects GROUP BY 1
  ),
  active AS (
    SELECT id::text AS user_id, last_sign_in_at AS at FROM auth.users
    UNION ALL
    SELECT owner_id::text, updated_at FROM public.cxd_projects
  )
  SELECT jsonb_build_object(
    'totalUsers', (SELECT count(*) FROM auth.users),
    'totalCanvases', (SELECT count(*) FROM public.cxd_projects),
    'signupsByDay', (SELECT jsonb_agg(jsonb_build_object('day', d.day, 'value', COALESCE(s.n, 0)) ORDER BY d.day) FROM days d LEFT JOIN signups s USING (day)),
    'canvasesByDay', (SELECT jsonb_agg(jsonb_build_object('day', d.day, 'value', COALESCE(c.n, 0)) ORDER BY d.day) FROM days d LEFT JOIN canvases c USING (day)),
    'active7d', (SELECT count(DISTINCT user_id) FROM active WHERE at >= now() - interval '7 days'),
    'active30d', (SELECT count(DISTINCT user_id) FROM active WHERE at >= now() - interval '30 days'),
    'creditsUsedPeriod', (SELECT COALESCE(sum(used_this_period), 0) FROM public.ai_credits),
    'feedbackCount', (SELECT count(*) FROM public.canvas_assistant_feedback WHERE created_at >= now() - make_interval(days => p_days)),
    'trackedEmails', (SELECT count(*) FROM public.email_log WHERE sent_at >= now() - make_interval(days => p_days)),
    'planRows', (
      SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb) FROM (
        SELECT plan_id::text AS plan_id, status::text AS status,
               stripe_subscription_id IS NOT NULL AS has_stripe_subscription,
               plan_source, count(*) AS n
          FROM public.subscriptions GROUP BY 1, 2, 3, 4
      ) p
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.admin_attention_summary(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_analytics_summary(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_attention_summary(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_analytics_summary(integer) TO service_role;
```

- [ ] **Step 2: Commit.** Message: `feat(admin): add dashboard snapshot table and summary functions`.

## Task 4: Source readers

**Files:** Create `src/lib/admin/analytics/sources.ts`

- [ ] **Step 1: Write it.**

```ts
import { unstable_cache } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/supabase/admin';
import { getStripe } from '@/lib/stripe';
import {
  computeMrr,
  computeRevenue,
  countsAsNewSubscriber,
  dayList,
  parseVisitors,
  type AttentionCounts,
  type CurrencyTotals,
  type PlanRow,
  type Range,
  type SourceResult,
  type SubscriptionInput,
} from './metrics';

const CACHE_SECONDS = 300;
const ATTENTION_CACHE_SECONDS = 60;
const SOURCE_TIMEOUT_MS = 8000;

/**
 * unstable_cache keeps serving a stale entry when a refresh fails, with no age limit.
 * The time bucket is part of the cache key, so each window gets a fresh read, and a
 * source that has broken reads as unavailable instead of showing an old value.
 */
const bucket = (seconds: number) => Math.floor(Date.now() / (seconds * 1000));

export function withTimeout<T>(work: Promise<T>, ms: number = SOURCE_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('source timed out')), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/** Failures throw inside the cached function, so a failure is never cached; the bucket bounds how long a good value lives. */
async function guarded<T>(source: string, read: () => Promise<T>): Promise<SourceResult<T>> {
  try {
    return { ok: true, data: await withTimeout(read()) };
  } catch (err) {
    Sentry.captureMessage(`admin analytics source failed: ${source}`, {
      level: 'warning',
      tags: { route: 'admin-analytics', source },
      extra: { message: err instanceof Error ? err.message : 'unknown' },
    });
    return { ok: false };
  }
}

export interface DayValue {
  day: string;
  value: number;
}

export interface AnalyticsSummary {
  totalUsers: number;
  totalCanvases: number;
  signupsByDay: DayValue[];
  canvasesByDay: DayValue[];
  active7d: number;
  active30d: number;
  creditsUsedPeriod: number;
  feedbackCount: number;
  trackedEmails: number;
  planRows: PlanRow[];
}

export async function fetchSummary(days: number): Promise<AnalyticsSummary> {
  const { data, error } = await getSupabaseAdmin().rpc('admin_analytics_summary', { p_days: days });
  if (error) throw new Error(error.message);
  return data as AnalyticsSummary;
}

const cachedAttention = unstable_cache(
  async (days: number, _bucket: number): Promise<AttentionCounts> => {
    const { data, error } = await getSupabaseAdmin().rpc('admin_attention_summary', { p_days: days });
    if (error) throw new Error(error.message);
    return data as AttentionCounts;
  },
  ['admin-attention'],
  { revalidate: ATTENTION_CACHE_SECONDS },
);

const cachedSummary = unstable_cache(
  async (days: number, _bucket: number): Promise<AnalyticsSummary> => fetchSummary(days),
  ['admin-summary'],
  { revalidate: CACHE_SECONDS },
);

async function listSubscriptions(): Promise<{
  inputs: SubscriptionInput[];
  created: { at: number; status: string }[];
  ended: number[];
}> {
  const inputs: SubscriptionInput[] = [];
  const created: { at: number; status: string }[] = [];
  const ended: number[] = [];
  for await (const subscription of getStripe().subscriptions.list({ status: 'all', limit: 100 })) {
    created.push({ at: subscription.created, status: subscription.status });
    // ended_at is when the subscription actually stopped, not when cancellation was requested.
    if (subscription.ended_at) ended.push(subscription.ended_at);
    inputs.push({
      status: subscription.status,
      items: subscription.items.data.map((item) => ({
        unitAmount: item.price.unit_amount,
        currency: item.price.currency,
        interval: item.price.recurring?.interval ?? 'month',
        intervalCount: item.price.recurring?.interval_count ?? 1,
        quantity: item.quantity ?? 1,
        usageType: item.price.recurring?.usage_type ?? 'licensed',
      })),
    });
  }
  return { inputs, created, ended };
}

export async function fetchMrr(): Promise<CurrencyTotals> {
  return computeMrr((await listSubscriptions()).inputs);
}

export interface StripeMetrics {
  mrr: CurrencyTotals;
  revenue: CurrencyTotals;
  newSubscribers: number;
  canceledSubscribers: number;
}

const cachedStripe = unstable_cache(
  async (days: number, _bucket: number): Promise<StripeMetrics> => {
    const since = Math.floor(Date.now() / 1000) - days * 86400;
    const listCharges = async () => {
      const charges = [];
      for await (const charge of getStripe().charges.list({ created: { gte: since }, limit: 100 })) {
        charges.push({
          amount: charge.amount,
          amountRefunded: charge.amount_refunded,
          currency: charge.currency,
          status: charge.status,
        });
      }
      return charges;
    };
    const [{ inputs, created, ended }, charges] = await Promise.all([listSubscriptions(), listCharges()]);
    return {
      mrr: computeMrr(inputs),
      revenue: computeRevenue(charges),
      newSubscribers: created.filter((s) => s.at >= since && countsAsNewSubscriber(s.status)).length,
      canceledSubscribers: ended.filter((at) => at >= since).length,
    };
  },
  ['admin-stripe'],
  { revalidate: CACHE_SECONDS },
);

export interface Snapshot {
  day: string;
  active_30d: number;
  mrr_cents: CurrencyTotals | null;
  credits_used_period: number;
}

const cachedSnapshots = unstable_cache(
  async (days: number, _bucket: number): Promise<Snapshot[]> => {
    const { data, error } = await getSupabaseAdmin()
      .from('admin_daily_metrics')
      .select('day, active_30d, mrr_cents, credits_used_period')
      .gte('day', dayList(days, new Date())[0])
      .order('day', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Snapshot[];
  },
  ['admin-snapshots'],
  { revalidate: CACHE_SECONDS },
);

export interface SystemMetrics {
  errors: { id: string; title: string | null; level: string | null; created_at: string }[];
  lastBroadcast: { subject: string; created_at: string; sent_count: number; failed_count: number } | null;
}

const cachedSystem = unstable_cache(
  async (_bucket: number): Promise<SystemMetrics> => {
    const admin = getSupabaseAdmin();
    const [errors, broadcast] = await Promise.all([
      admin.from('fix_pipeline').select('id, title, level, created_at').order('created_at', { ascending: false }).limit(5),
      admin
        .from('broadcasts')
        .select('subject, created_at, sent_count, failed_count')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (errors.error) throw new Error(errors.error.message);
    if (broadcast.error) throw new Error(broadcast.error.message);
    return { errors: errors.data ?? [], lastBroadcast: broadcast.data };
  },
  ['admin-system'],
  { revalidate: CACHE_SECONDS },
);

/** No token, or a plan that refuses the API, is an expected state and not an error. */
const cachedVisitors = unstable_cache(
  async (days: number, _bucket: number): Promise<number | null> => {
    const token = process.env.VERCEL_ANALYTICS_TOKEN;
    const projectId = process.env.VERCEL_ANALYTICS_PROJECT_ID;
    if (!token || !projectId) return null;
    const until = Date.now();
    const params = new URLSearchParams({
      projectId,
      since: String(until - days * 86400000),
      until: String(until),
    });
    if (process.env.VERCEL_TEAM_ID) params.set('teamId', process.env.VERCEL_TEAM_ID);
    const response = await fetch(`https://api.vercel.com/v1/query/web-analytics/visits/count?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (response.status === 401 || response.status === 403 || response.status === 404) return null;
    if (!response.ok) throw new Error(`vercel responded ${response.status}`);
    return parseVisitors(await response.json());
  },
  ['admin-visitors'],
  { revalidate: CACHE_SECONDS },
);

// Callers must check permission first: cached values are shared between viewers.
export const readAttention = (range: Range) =>
  guarded('attention', () => cachedAttention(range, bucket(ATTENTION_CACHE_SECONDS)));
export const readSummary = (range: Range) => guarded('supabase', () => cachedSummary(range, bucket(CACHE_SECONDS)));
export const readStripe = (range: Range) => guarded('stripe', () => cachedStripe(range, bucket(CACHE_SECONDS)));
export const readSnapshots = (range: Range) => guarded('snapshots', () => cachedSnapshots(range, bucket(CACHE_SECONDS)));
export const readSystem = () => guarded('system', () => cachedSystem(bucket(CACHE_SECONDS)));
export const readVisitors = (range: Range) => guarded('vercel', () => cachedVisitors(range, bucket(CACHE_SECONDS)));
```

- [ ] **Step 2: Type-check.** `npx tsc --noEmit`. Expected: no new errors. If a Stripe field name fails, read `node_modules/stripe/types` for version 17.6.0.

- [ ] **Step 3: Commit.** Message: `feat(admin): add dashboard source readers`.

## Task 5: Nightly snapshot

**Files:** Create `src/app/api/cron/admin-metrics/route.ts`. Modify `vercel.json`.

- [ ] **Step 1: Write the route.**

```ts
// Nightly dashboard snapshot of the numbers that cannot be rebuilt later.
// Upserts today's row, so a rerun is safe.

import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/supabase/admin';
import { classifyUsers } from '@/lib/admin/analytics/metrics';
import { fetchMrr, fetchSummary, withTimeout } from '@/lib/admin/analytics/sources';

export const dynamic = 'force-dynamic';

const STRIPE_TIMEOUT_MS = 30000;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[admin-metrics] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server config error' }, { status: 500 });
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await fetchSummary(30);
    // A Stripe failure leaves mrr_cents out of the upsert: a new row keeps the column's null
    // default (a gap, not a false zero) and a rerun cannot erase a value saved earlier today.
    const mrr = await withTimeout(fetchMrr(), STRIPE_TIMEOUT_MS).catch((err) => {
      Sentry.captureException(err, { tags: { route: 'admin-metrics', source: 'stripe' } });
      return null;
    });
    const users = classifyUsers(summary.planRows, summary.totalUsers);

    const { error } = await getSupabaseAdmin().from('admin_daily_metrics').upsert({
      day: new Date().toISOString().slice(0, 10),
      active_7d: summary.active7d,
      active_30d: summary.active30d,
      ...(mrr ? { mrr_cents: mrr } : {}),
      paying_users: users.paying,
      comped_users: users.comped,
      free_users: users.free,
      credits_used_period: summary.creditsUsedPeriod,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'admin-metrics' } });
    return NextResponse.json({ error: 'Snapshot failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add the cron.** In `vercel.json`, append to `crons`:

```json
    {
      "path": "/api/cron/admin-metrics",
      "schedule": "0 3 * * *"
    }
```

- [ ] **Step 3: Commit.** Message: `feat(admin): add nightly dashboard snapshot`.

## Task 6: Dashboard page

**Files:** Create `src/components/admin/dashboard/panels.tsx`, `src/components/admin/dashboard/trend-chart.tsx`. Modify `src/app/admin/page.tsx`, `src/components/admin/admin-nav.tsx`.

Load the `dataviz` skill before writing the chart.

- [ ] **Step 1: Write the chart.** `trend-chart.tsx`:

```tsx
'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface TrendPoint {
  day: string;
  value: number | null;
}

export function TrendChart({ data, label }: { data: TrendPoint[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="day" tickFormatter={(day: string) => day.slice(5)} stroke="rgba(255,255,255,0.4)" fontSize={11} minTickGap={32} />
          <YAxis allowDecimals={false} stroke="rgba(255,255,255,0.4)" fontSize={11} width={40} />
          <Tooltip contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12 }} />
          <Area type="monotone" dataKey="value" name={label} stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.15} connectNulls={false} dot={{ r: 2, strokeWidth: 0, fill: '#a78bfa' }} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Write the panels.** `panels.tsx`:

```tsx
import type { ReactNode } from 'react';
import Link from 'next/link';
import { formatMoney, isAllClear, type AttentionCounts, type CurrencyTotals, type SourceResult } from '@/lib/admin/analytics/metrics';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="text-sm font-medium text-white/60">{title}</h2>
      {children}
    </section>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 [&>*]:min-w-0">{children}</div>;
}

export function Panel({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 min-w-0">{children}</div>;
}

export function Unavailable() {
  return <p className="text-sm text-white/40">Unavailable</p>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Panel>
      <p className="text-xs text-white/50">{label}</p>
      <div className="mt-1 text-xl sm:text-2xl font-semibold tabular-nums break-words">{value}</div>
      {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
    </Panel>
  );
}

export function Money({ totals }: { totals: CurrencyTotals }) {
  const currencies = Object.keys(totals);
  if (currencies.length === 0) return <>{formatMoney(0, 'usd')}</>;
  return (
    <>
      {currencies.map((currency) => (
        <div key={currency}>{formatMoney(totals[currency], currency)}</div>
      ))}
    </>
  );
}

function AttentionLink({ href, label, count }: { href: string; label: string; count: number }) {
  return (
    <Link href={href} className="rounded-lg border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06]">
      <p className="text-xs text-white/50">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${count > 0 ? 'text-amber-300' : ''}`}>{count}</p>
    </Link>
  );
}

export function AttentionStrip({ result, canSeeComms }: { result: SourceResult<AttentionCounts>; canSeeComms: boolean }) {
  if (!result.ok) return <Panel><Unavailable /></Panel>;
  if (isAllClear(result)) return <Panel><p className="text-sm text-emerald-400">All clear</p></Panel>;
  const { openTickets, highPriorityTickets, unresolvedErrors, failedPayments, failedEmails } = result.data;
  return (
    <Grid>
      <AttentionLink href="/admin/support" label={highPriorityTickets ? `Open cards (${highPriorityTickets} high)` : 'Open cards'} count={openTickets} />
      <AttentionLink href="/admin/errors" label="Unresolved errors" count={unresolvedErrors} />
      <AttentionLink href="/admin/users" label="Failed payments" count={failedPayments} />
      <AttentionLink href={canSeeComms ? '/admin/comms' : '/admin/support'} label="Failed emails" count={failedEmails} />
    </Grid>
  );
}
```

- [ ] **Step 3: Write the page.** Replace `src/app/admin/page.tsx`:

```tsx
import Link from 'next/link';
import { requirePagePermission } from '@/lib/admin/gate';
import { can } from '@/lib/admin/permissions';
import { singleParam } from '@/lib/admin/users-query';
import {
  classifyUsers,
  fillDays,
  parseRange,
  planMix,
  RANGES,
  toMajorUnits,
  type CurrencyTotals,
} from '@/lib/admin/analytics/metrics';
import {
  readAttention,
  readSnapshots,
  readStripe,
  readSummary,
  readSystem,
  readVisitors,
} from '@/lib/admin/analytics/sources';
import { AttentionStrip, Grid, Money, Panel, Section, Stat, Unavailable } from '@/components/admin/dashboard/panels';
import { TrendChart } from '@/components/admin/dashboard/trend-chart';
import type { Snapshot } from '@/lib/admin/analytics/sources';

const VERCEL_ANALYTICS_URL = 'https://vercel.com/dashboard';
const MIN_TREND_POINTS = 2;

function mrrTotal(totals: CurrencyTotals | null): number | null {
  // Charts need one number per day, and no currency is converted.
  if (!totals) return null;
  const currencies = Object.keys(totals);
  return currencies.length === 1 ? toMajorUnits(totals[currencies[0]], currencies[0]) : currencies.length === 0 ? 0 : null;
}

export default async function AdminHome({ searchParams }: { searchParams: { range?: string | string[] } }) {
  const staff = await requirePagePermission('tickets.work');
  const range = parseRange(singleParam(searchParams.range));
  const canSeeComms = can(staff.role, 'comms.send');

  // Staff stop here: only the attention counts are read, and no analytics reader is called for them.
  if (!can(staff.role, 'analytics.view')) {
    const attention = await readAttention(range);
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Home</h1>
        <Section title="Needs attention">
          <AttentionStrip result={attention} canSeeComms={canSeeComms} />
        </Section>
      </div>
    );
  }

  const [attention, summary, stripe, snapshots, system, visitors] = await Promise.all([
    readAttention(range),
    readSummary(range),
    readStripe(range),
    readSnapshots(range),
    readSystem(),
    readVisitors(range),
  ]);
  const users = summary.ok ? classifyUsers(summary.data.planRows, summary.data.totalUsers) : null;
  const history = snapshots.ok ? snapshots.data : [];
  // Real rows decide whether there is a trend; filled days only add the gaps for missed nights.
  const hasHistory = history.length >= MIN_TREND_POINTS;
  const filled = fillDays(history, range, new Date());
  const collecting = history[0] ? `Collecting since ${history[0].day}` : 'Collecting starts after the first nightly run';

  const snapshotTrend = (label: string, pick: (row: Snapshot) => number | null) => {
    if (!snapshots.ok) return <Unavailable />;
    if (!hasHistory) return <p className="text-sm text-white/40">{collecting}</p>;
    return <TrendChart label={label} data={filled.map(({ day, row }) => ({ day, value: row ? pick(row) : null }))} />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Home</h1>
        <nav aria-label="Date range" className="flex gap-1 text-sm">
          {RANGES.map((value) => (
            <Link
              key={value}
              href={`/admin?range=${value}`}
              aria-current={value === range ? 'true' : undefined}
              className={`rounded-md px-3 py-1.5 ${value === range ? 'bg-violet-500/20 text-violet-100' : 'text-white/60 hover:bg-white/5'}`}
            >
              {value} days
            </Link>
          ))}
        </nav>
      </div>

      <Section title="Needs attention">
        <AttentionStrip result={attention} canSeeComms={canSeeComms} />
      </Section>

      <Section title="Business">
        <Grid>
          <Stat label="MRR (list price)" value={stripe.ok ? <Money totals={stripe.data.mrr} /> : <Unavailable />} />
          <Stat label={`Revenue, ${range} days`} value={stripe.ok ? <Money totals={stripe.data.revenue} /> : <Unavailable />} />
          <Stat
            label="Paying users"
            value={users ? users.paying : <Unavailable />}
            hint={users && users.trialing > 0 ? `+${users.trialing} on trial` : undefined}
          />
          <Stat label="Comped users" value={users ? users.comped : <Unavailable />} hint="Beta, Nexus and admin plans" />
          <Stat
            label={`New subscribers, ${range} days`}
            value={stripe.ok ? stripe.data.newSubscribers : <Unavailable />}
            hint="Includes trials"
          />
          <Stat label={`Cancelled, ${range} days`} value={stripe.ok ? stripe.data.canceledSubscribers : <Unavailable />} />
        </Grid>
        <Panel>
          <p className="mb-2 text-xs text-white/50">MRR trend</p>
          {snapshotTrend('MRR', (row) => mrrTotal(row.mrr_cents))}
        </Panel>
      </Section>

      <Section title="Growth">
        <Grid>
          <Stat label="Active, 7 days" value={summary.ok ? summary.data.active7d : <Unavailable />} />
          <Stat label="Active, 30 days" value={summary.ok ? summary.data.active30d : <Unavailable />} />
          <Stat label="Total users" value={summary.ok ? summary.data.totalUsers : <Unavailable />} />
          <Stat
            label={`Visitors, ${range} days`}
            value={
              visitors.ok && visitors.data !== null ? (
                visitors.data
              ) : (
                <a href={VERCEL_ANALYTICS_URL} target="_blank" rel="noreferrer" className="text-sm font-normal text-violet-200 hover:underline">
                  Available in Vercel
                </a>
              )
            }
          />
        </Grid>
        <div className="grid lg:grid-cols-2 gap-3">
          <Panel>
            <p className="mb-2 text-xs text-white/50">Signups per day</p>
            {summary.ok ? <TrendChart label="Signups" data={summary.data.signupsByDay} /> : <Unavailable />}
          </Panel>
          <Panel>
            <p className="mb-2 text-xs text-white/50">Active users, 30 days</p>
            {snapshotTrend('Active users', (row) => row.active_30d)}
          </Panel>
        </div>
      </Section>

      <Section title="Product usage">
        <Grid>
          <Stat label="Total canvases" value={summary.ok ? summary.data.totalCanvases : <Unavailable />} />
          <Stat label="AI credits this period" value={summary.ok ? summary.data.creditsUsedPeriod : <Unavailable />} />
          <Stat label={`Assistant feedback, ${range} days`} value={summary.ok ? summary.data.feedbackCount : <Unavailable />} />
          <Stat label="Free users" value={users ? users.free : <Unavailable />} />
        </Grid>
        <Panel>
          <p className="mb-2 text-xs text-white/50">Plan mix (subscription rows)</p>
          {summary.ok ? (
            <ul className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1 text-sm">
              {planMix(summary.data.planRows).map(({ plan, n }) => (
                <li key={plan} className="flex justify-between gap-2">
                  <span className="truncate text-white/70">{plan.replace(/_/g, ' ')}</span>
                  <span className="tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Unavailable />
          )}
        </Panel>
        <div className="grid lg:grid-cols-2 gap-3">
          <Panel>
            <p className="mb-2 text-xs text-white/50">Canvases created per day</p>
            {summary.ok ? <TrendChart label="Canvases" data={summary.data.canvasesByDay} /> : <Unavailable />}
          </Panel>
          <Panel>
            <p className="mb-2 text-xs text-white/50">AI credits used</p>
            {snapshotTrend('AI credits', (row) => row.credits_used_period)}
          </Panel>
        </div>
      </Section>

      <Section title="System">
        <div className="grid lg:grid-cols-2 gap-3">
          <Panel>
            <p className="mb-2 text-xs text-white/50">Recent errors</p>
            {!system.ok && <Unavailable />}
            {system.ok && system.data.errors.length === 0 && <p className="text-sm text-white/40">No triaged errors.</p>}
            {system.ok &&
              system.data.errors.map((error) => (
                <Link key={error.id} href="/admin/errors" className="block truncate text-sm text-violet-200 hover:underline">
                  {error.title ?? 'Untitled error'}
                </Link>
              ))}
          </Panel>
          <Panel>
            <p className="text-xs text-white/50">Tracked emails, {range} days</p>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {summary.ok ? summary.data.trackedEmails : <Unavailable />}
            </div>
            <p className="mt-3 text-xs text-white/50">Last broadcast</p>
            {system.ok && system.data.lastBroadcast ? (
              <p className="mt-1 text-sm">
                {system.data.lastBroadcast.subject} · {system.data.lastBroadcast.sent_count} sent, {system.data.lastBroadcast.failed_count} failed
              </p>
            ) : (
              <p className="mt-1 text-sm text-white/40">{system.ok ? 'None yet.' : 'Unavailable'}</p>
            )}
          </Panel>
        </div>
      </Section>
    </div>
  );
}
```

Read `src/lib/admin/users-query.ts` first and match `singleParam`'s real signature.

- [ ] **Step 4: Add Home to the nav.** In `admin-nav.tsx`, add `Home` to the lucide import, add this as the first item of `ITEMS`:

```tsx
  { href: '/admin', label: 'Home', icon: Home, permission: 'tickets.work' },
```

and replace the `active` line, because every admin path starts with `/admin`:

```tsx
        const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
```

- [ ] **Step 5: Check and build.** Run `npx --yes tsx src/lib/admin/__verify__/admin-routes.verify.ts`, `npx tsc --noEmit` and `npm run build`. Expected: 8 pages checked, no new errors, build succeeds. The build must not call Stripe or Vercel, because the page is dynamic through the admin layout.

- [ ] **Step 6: Commit.** Message: `feat(admin): add home dashboard`.

## Task 7: Visitor tracking

**Files:** Modify `package.json`, `package-lock.json`, `src/app/layout.tsx`, `.env.example`, `src/lib/env.ts`. Create `src/components/privacy-analytics.tsx`, `src/lib/analytics-url.ts`, `src/lib/admin/__verify__/analytics-url.verify.ts`.

- [ ] **Step 1: Install.** `npm install @vercel/analytics`.

- [ ] **Step 2: Add the component.** Create `src/components/privacy-analytics.tsx` (a client component rendering `<Analytics beforeSend={...} />` that runs `redactAnalyticsUrl` on every event URL), `src/lib/analytics-url.ts` (the pure helper: strips query string and fragment, replaces the token in `/cxd/share/<token>` and the ids in `/cxd/overview/<id>`, `/admin/users/<id>` and `/admin/support/<id>`) and `src/lib/admin/__verify__/analytics-url.verify.ts`. In `src/app/layout.tsx`, import `PrivacyAnalytics` from `@/components/privacy-analytics` below the Speed Insights import and render `<PrivacyAnalytics />` directly after `<SpeedInsights />`. The final code is in those files.

- [ ] **Step 3: Declare env vars.** Add `'VERCEL_ANALYTICS_TOKEN'`, `'VERCEL_ANALYTICS_PROJECT_ID'` and `'VERCEL_TEAM_ID'` to `optionalServerVars` in `src/lib/env.ts`. Add to `.env.example`:

```bash
# Optional: visitor numbers on /admin. Needs Web Analytics enabled in Vercel.
VERCEL_ANALYTICS_TOKEN=
# Project id or name
VERCEL_ANALYTICS_PROJECT_ID=
# Only for team-owned projects
VERCEL_TEAM_ID=
```

- [ ] **Step 4: Build and commit.** `npm run build`. Message: `feat(admin): add Vercel Web Analytics tracking`. A later review round added the privacy wrapper and several fixes, which the code blocks above already reflect.

## Task 8: Verify and hand off

- [ ] **Step 1:** Run every script in `src/lib/admin/__verify__/`. Expected: all exit 0.
- [ ] **Step 2:** `npm run build`. Expected: succeeds.
- [ ] **Step 3:** Stop and report. The owner decides on applying `20261101000001_admin_analytics.sql` and merging.
