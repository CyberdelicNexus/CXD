/**
 * Who a broadcast reaches, and that the test send matches the content sent.
 * Run: npx tsx src/lib/admin/__verify__/broadcast-audience.verify.ts
 */
import { filterRecipients, signContent, verifyContent, type RecipientRow } from '../comms';

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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
