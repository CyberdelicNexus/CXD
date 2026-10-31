/**
 * Who a broadcast reaches, and that the test send matches the content sent.
 * Run: npx tsx src/lib/admin/__verify__/broadcast-audience.verify.ts
 */
import {
  IN_APP_BODY_MAX, chunk, collectPages, contentSchema, filterRecipients, inAppBodyFits, notificationId,
  signContent, verifyContent, type RecipientRow,
} from '../comms';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗', name); }
}

const rows: RecipientRow[] = [
  { user_id: 'a', email: 'a@x.co', name: 'A', email_confirmed: true, banned: false, opted_out: false },
  { user_id: 'b', email: 'b@x.co', name: 'B', email_confirmed: true, banned: false, opted_out: true },
  { user_id: 'c', email: 'c@x.co', name: 'C', email_confirmed: true, banned: true, opted_out: false },
  { user_id: 'd', email: 'd@x.co', name: 'D', email_confirmed: false, banned: false, opted_out: false },
];

const ids = (list: RecipientRow[]) => list.map((r) => r.user_id).join();

const product = filterRecipients(rows, 'product');
check('product update skips opt-outs', ids(product.email) === 'a');
const service = filterRecipients(rows, 'service');
check('service notice reaches opt-outs', ids(service.email) === 'a,b');
check('suspended get nothing', !ids(product.inApp).includes('c') && !ids(service.email).includes('c'));
check('unconfirmed get no email', !ids(service.email).includes('d'));
check('in-app ignores email opt-out', ids(product.inApp) === 'a,b,d');

const content = { subject: 'Hello', body: 'World', category: 'product' as const };
const token = signContent(content, 'user-1', 'secret');
check('matching content verifies', verifyContent(token, content, 'user-1', 'secret'));
check('edited body refused', !verifyContent(token, { ...content, body: 'Changed' }, 'user-1', 'secret'));
check('edited category refused', !verifyContent(token, { ...content, category: 'service' }, 'user-1', 'secret'));
check('other sender refused', !verifyContent(token, content, 'user-2', 'secret'));
check('junk refused', !verifyContent('junk', content, 'user-1', 'secret'));

const longBody = 'x'.repeat(IN_APP_BODY_MAX + 1);
check('long in-app body refused', !inAppBodyFits({ channels: ['in_app'], body: longBody }));
check('long email-only body allowed', inAppBodyFits({ channels: ['email'], body: longBody }));
check('body at the cap allowed', inAppBodyFits({ channels: ['in_app', 'email'], body: 'x'.repeat(IN_APP_BODY_MAX) }));
const base = { category: 'service', audience: { kind: 'all' }, subject: 'S' };
check('schema refuses long in-app body', !contentSchema.safeParse({ ...base, channels: ['in_app'], body: longBody }).success);
check('schema accepts long email body', contentSchema.safeParse({ ...base, channels: ['email'], body: longBody }).success);

const n1 = notificationId('b1', 'u1');
check('notification id is stable', n1 === notificationId('b1', 'u1'));
check('notification id differs by user', n1 !== notificationId('b1', 'u2'));
check('notification id differs by broadcast', n1 !== notificationId('b2', 'u1'));
check('notification id is a uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(n1));

check('chunk splits evenly', JSON.stringify(chunk([1, 2, 3, 4, 5], 2)) === '[[1,2],[3,4],[5]]');
check('chunk of nothing is nothing', chunk([], 3).length === 0);

async function paging() {
  const source = Array.from({ length: 2500 }, (_, i) => i);
  const calls: number[] = [];
  const got = await collectPages(async (from, to) => { calls.push(from); return source.slice(from, to + 1); }, 1000);
  check('paging reads past the row cap', got.length === 2500 && got[2499] === 2499);
  check('paging stops on a short page', calls.length === 3);
  const exactSource = Array.from({ length: 2000 }, (_, i) => i);
  const exact = await collectPages(async (from, to) => exactSource.slice(from, to + 1), 1000);
  check('paging an exact multiple ends on an empty page', exact.length === 2000);
  let threw = false;
  await collectPages(async () => { throw new Error('boom'); }, 1000).catch(() => { threw = true; });
  check('a failed page throws', threw);
}

paging().then(() => {
  console.log(`
${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
});
