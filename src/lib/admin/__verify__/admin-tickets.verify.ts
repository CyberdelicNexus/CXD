/**
 * Ticket title and body shaping for /api/support.
 * Run: npx tsx src/lib/admin/__verify__/admin-tickets.verify.ts
 */
import { composeTicketBody, isHttpUrl, parseTicketFilters, resolveTicketType, ticketTitle } from '../tickets';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗', name); }
}

check('explicit type wins', resolveTicketType('feature', 'Bug Report') === 'feature');
check('legacy bug title', resolveTicketType(undefined, 'Bug Report') === 'bug');
check('legacy default', resolveTicketType(undefined, 'Support Request') === 'support');
check('unknown type falls back', resolveTicketType('nonsense', 'Support Request') === 'support');

check('generic title uses description', ticketTitle('Bug Report', 'The canvas froze') === 'The canvas froze');
check('real title kept', ticketTitle('Export broken', 'Details') === 'Export broken');
check('long description cut at 80', ticketTitle('Support Request', 'x'.repeat(200)).length === 80);
check('first line only', ticketTitle('Bug Report', 'First\nSecond') === 'First');

check('body without steps', composeTicketBody('Hello', undefined) === 'Hello');
check('body with steps', composeTicketBody('Hello', '1. Click').includes('Steps to reproduce:\n1. Click'));

const UID = '123e4567-e89b-12d3-a456-426614174000';
check('valid filters kept', JSON.stringify(parseTicketFilters({ type: 'bug', priority: 'high', assignee: UID })) === JSON.stringify({ type: 'bug', priority: 'high', assignee: UID }));
check('invalid type dropped', parseTicketFilters({ type: 'x' }).type === undefined);
check('invalid priority dropped', parseTicketFilters({ priority: 'urgent' }).priority === undefined);
check('invalid assignee dropped', parseTicketFilters({ assignee: 'abc,id.eq.1' }).assignee === undefined);

check('https link allowed', isHttpUrl('https://sentry.io/issues/1'));
check('http link allowed', isHttpUrl('http://example.com'));
check('javascript link refused', !isHttpUrl('javascript:alert(1)'));
check('data link refused', !isHttpUrl('data:text/html,hi'));
check('garbage refused', !isHttpUrl('not a url'));
check('null refused', !isHttpUrl(null));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
