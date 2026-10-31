/**
 * Ticket title and body shaping for /api/support.
 * Run: npx tsx src/lib/admin/__verify__/admin-tickets.verify.ts
 */
import { composeTicketBody, resolveTicketType, ticketTitle } from '../tickets';

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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
