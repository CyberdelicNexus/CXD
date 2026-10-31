/**
 * Pure helpers behind the Users pages and routes.
 * Run: npx tsx src/lib/admin/__verify__/admin-users.verify.ts
 */
import { isUuid } from '../http';
import { parsePage, singleParam, MAX_PAGE } from '../users-query';
import { canSuspend, SUSPEND_REFUSED } from '../permissions';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗', name); }
}

check('a UUID is accepted', isUuid('322d15dd-8477-41ff-8980-f344fda14164'));
check('uppercase UUID is accepted', isUuid('322D15DD-8477-41FF-8980-F344FDA14164'));
check('a short id is refused', !isUuid('123'));
check('a path-like id is refused', !isUuid('../etc'));
check('an id with a suffix is refused', !isUuid('322d15dd-8477-41ff-8980-f344fda14164x'));
check('undefined is refused', !isUuid(undefined));

check('page defaults to 1', parsePage(undefined) === 1);
check('page 3 parses', parsePage('3') === 3);
check('page 0 becomes 1', parsePage('0') === 1);
check('negative page becomes 1', parsePage('-4') === 1);
check('fractional page becomes 1', parsePage('2.5') === 1);
check('non-numeric page becomes 1', parsePage('abc') === 1);
check('huge page is capped', parsePage('99999999999') === MAX_PAGE);
check('repeated page uses the first', parsePage(['2', '9']) === 2);
check('repeated q uses the first', singleParam(['a', 'b']) === 'a');
check('empty q is undefined', singleParam('') === undefined);

check('suspending yourself is refused', canSuspend({ actorId: 'a', actorRole: 'owner', targetId: 'a', targetRole: 'owner' }) === 'self');
check('every refusal has text', (['self', 'owner', 'role_holder'] as const).every((k) => SUSPEND_REFUSED[k].length > 0));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
