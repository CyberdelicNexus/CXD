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
