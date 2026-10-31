/**
 * Signed unsubscribe tokens.
 * Run: npx tsx src/lib/admin/__verify__/unsubscribe-token.verify.ts
 */
import { signUnsubscribeToken, verifyUnsubscribeToken } from '../../email-unsubscribe';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗', name); }
}

const USER = '322d15dd-8477-41ff-8980-f344fda14164';
const token = signUnsubscribeToken(USER, 'secret-one');

check('round trip', verifyUnsubscribeToken(token, 'secret-one') === USER);
check('wrong secret refused', verifyUnsubscribeToken(token, 'secret-two') === null);
check('tampered signature refused', verifyUnsubscribeToken(`${token.slice(0, -2)}xx`, 'secret-one') === null);
check('swapped user refused', verifyUnsubscribeToken(`${Buffer.from('other').toString('base64url')}.${token.split('.')[1]}`, 'secret-one') === null);
check('junk refused', verifyUnsubscribeToken('junk', 'secret-one') === null);
check('empty refused', verifyUnsubscribeToken('', 'secret-one') === null);
check('missing secret refused', verifyUnsubscribeToken(token, '') === null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
