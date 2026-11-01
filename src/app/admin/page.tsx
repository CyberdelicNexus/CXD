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
