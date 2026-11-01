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
  }[];
}

const INTERVALS_PER_MONTH = { day: 365 / 12, week: 52 / 12, month: 1, year: 1 / 12 };

/** List price of active subscriptions: trials, past-due and discounts are not counted. */
export function computeMrr(subscriptions: SubscriptionInput[]): CurrencyTotals {
  const totals: CurrencyTotals = {};
  for (const subscription of subscriptions) {
    if (subscription.status !== 'active') continue;
    for (const item of subscription.items) {
      if (item.unitAmount == null) continue;
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

const ENDED_STATUSES = ['canceled', 'incomplete_expired'];

function isPaying(row: PlanRow): boolean {
  if (row.has_stripe_subscription && !ENDED_STATUSES.includes(row.status)) return true;
  return row.plan_id === 'lifetime' && row.plan_source === null;
}

/** Comped is any non-free plan nobody pays for, so beta testers never read as revenue. */
export function classifyUsers(rows: PlanRow[], totalUsers: number) {
  let paying = 0;
  let comped = 0;
  for (const row of rows) {
    if (isPaying(row)) paying += row.n;
    else if (row.plan_id !== 'free') comped += row.n;
  }
  return { paying, comped, free: Math.max(totalUsers - paying - comped, 0) };
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
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}
