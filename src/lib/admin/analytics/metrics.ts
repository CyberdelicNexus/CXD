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
