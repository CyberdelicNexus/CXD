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
check('comped never counts as paying', mix.comped === 29);
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

check('free includes users with no subscription row', mix.free === 13);

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
