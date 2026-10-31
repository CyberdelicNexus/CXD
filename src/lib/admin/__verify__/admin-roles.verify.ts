/**
 * Permission matrix and gate decisions for the admin console.
 * Run: npx tsx src/lib/admin/__verify__/admin-roles.verify.ts
 */
import { PERMISSIONS, can, gateStatus, canSuspend, isBanned, isStaffRole, type Permission, type StaffRole } from '../permissions';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗', name); }
}

const EXPECTED: Record<StaffRole, Permission[]> = {
  staff: ['users.view', 'tickets.work', 'errors.view'],
  admin: ['users.view', 'tickets.work', 'errors.view', 'users.edit', 'comms.send', 'audit.view'],
  owner: [...PERMISSIONS],
};

for (const role of Object.keys(EXPECTED) as StaffRole[]) {
  for (const permission of PERMISSIONS) {
    const expected = EXPECTED[role].includes(permission);
    check(`${role} ${expected ? 'has' : 'lacks'} ${permission}`, can(role, permission) === expected);
  }
}
check('no role has nothing', PERMISSIONS.every((p) => !can(null, p)));

check('signed out is 401', gateStatus(false, null, 'users.view') === 401);
check('member is 403', gateStatus(true, null, 'users.view') === 403);
check('failed lookup denies', gateStatus(true, undefined, 'users.view') === 403);
check('staff denied edit', gateStatus(true, 'staff', 'users.edit') === 403);
check('admin denied roles', gateStatus(true, 'admin', 'roles.assign') === 403);
check('owner allowed roles', gateStatus(true, 'owner', 'roles.assign') === 200);

check('unknown role rejected', !isStaffRole('superuser'));
check('known role accepted', isStaffRole('staff'));

const base = { actorId: 'a', actorRole: 'admin' as StaffRole, targetId: 'b', targetRole: null };
check('admin suspends member', canSuspend(base) === null);
check('cannot suspend self', canSuspend({ ...base, targetId: 'a' }) === 'self');
check('cannot suspend owner', canSuspend({ ...base, actorRole: 'owner', targetRole: 'owner' }) === 'owner');
check('admin cannot suspend staff', canSuspend({ ...base, targetRole: 'staff' }) === 'role_holder');
check('owner can suspend admin', canSuspend({ ...base, actorRole: 'owner', targetRole: 'admin' }) === null);

const now = new Date('2026-11-01T00:00:00Z');
check('future ban is banned', isBanned('2030-01-01T00:00:00Z', now));
check('past ban is not', !isBanned('2020-01-01T00:00:00Z', now));
check('no ban is not', !isBanned(null, now));
check('unparsable ban is banned', isBanned('not-a-date', now));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
