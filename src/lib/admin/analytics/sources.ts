import { unstable_cache } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/supabase/admin';
import { getStripe } from '@/lib/stripe';
import {
  computeMrr,
  computeRevenue,
  parseVisitors,
  type AttentionCounts,
  type CurrencyTotals,
  type PlanRow,
  type Range,
  type SourceResult,
  type SubscriptionInput,
} from './metrics';

const CACHE_SECONDS = 300;
const SOURCE_TIMEOUT_MS = 8000;

function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('source timed out')), SOURCE_TIMEOUT_MS);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/** Failures throw inside the cached function, so a failure is never cached. */
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
  async (days: number): Promise<AttentionCounts> => {
    const { data, error } = await getSupabaseAdmin().rpc('admin_attention_summary', { p_days: days });
    if (error) throw new Error(error.message);
    return data as AttentionCounts;
  },
  ['admin-attention'],
  { revalidate: 60 },
);

const cachedSummary = unstable_cache(fetchSummary, ['admin-summary'], { revalidate: CACHE_SECONDS });

async function listSubscriptions(): Promise<{ inputs: SubscriptionInput[]; created: number[]; canceled: number[] }> {
  const inputs: SubscriptionInput[] = [];
  const created: number[] = [];
  const canceled: number[] = [];
  for await (const subscription of getStripe().subscriptions.list({ status: 'all', limit: 100 })) {
    created.push(subscription.created);
    if (subscription.canceled_at) canceled.push(subscription.canceled_at);
    inputs.push({
      status: subscription.status,
      items: subscription.items.data.map((item) => ({
        unitAmount: item.price.unit_amount,
        currency: item.price.currency,
        interval: item.price.recurring?.interval ?? 'month',
        intervalCount: item.price.recurring?.interval_count ?? 1,
        quantity: item.quantity ?? 1,
      })),
    });
  }
  return { inputs, created, canceled };
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
  async (days: number): Promise<StripeMetrics> => {
    const since = Math.floor(Date.now() / 1000) - days * 86400;
    const { inputs, created, canceled } = await listSubscriptions();
    const charges = [];
    for await (const charge of getStripe().charges.list({ created: { gte: since }, limit: 100 })) {
      charges.push({
        amount: charge.amount,
        amountRefunded: charge.amount_refunded,
        currency: charge.currency,
        status: charge.status,
      });
    }
    return {
      mrr: computeMrr(inputs),
      revenue: computeRevenue(charges),
      newSubscribers: created.filter((at) => at >= since).length,
      canceledSubscribers: canceled.filter((at) => at >= since).length,
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
  async (days: number): Promise<Snapshot[]> => {
    const { data, error } = await getSupabaseAdmin()
      .from('admin_daily_metrics')
      .select('day, active_30d, mrr_cents, credits_used_period')
      .order('day', { ascending: false })
      .limit(days);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Snapshot[]).reverse();
  },
  ['admin-snapshots'],
  { revalidate: CACHE_SECONDS },
);

export interface SystemMetrics {
  errors: { id: string; title: string; level: string | null; created_at: string }[];
  lastBroadcast: { subject: string; created_at: string; sent_count: number; failed_count: number } | null;
}

const cachedSystem = unstable_cache(
  async (): Promise<SystemMetrics> => {
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
  async (days: number): Promise<number | null> => {
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
export const readAttention = (range: Range) => guarded('attention', () => cachedAttention(range));
export const readSummary = (range: Range) => guarded('supabase', () => cachedSummary(range));
export const readStripe = (range: Range) => guarded('stripe', () => cachedStripe(range));
export const readSnapshots = (range: Range) => guarded('snapshots', () => cachedSnapshots(range));
export const readSystem = () => guarded('system', () => cachedSystem());
export const readVisitors = (range: Range) => guarded('vercel', () => cachedVisitors(range));
