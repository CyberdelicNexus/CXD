/**
 * Admin roles and permissions. Pure, so it can be verified without a request.
 * Code checks permissions, never role names.
 */

export const ROLES = ['staff', 'admin', 'owner'] as const;
export type StaffRole = (typeof ROLES)[number];

/** Roles the app may grant. Owner rows are migration-only. */
export const ASSIGNABLE_ROLES = ['staff', 'admin'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const PERMISSIONS = [
  'users.view',
  'tickets.work',
  'errors.view',
  'users.edit',
  'comms.send',
  'audit.view',
  'analytics.view',
  'roles.assign',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALLOWED: Record<Permission, readonly StaffRole[]> = {
  'users.view': ['staff', 'admin', 'owner'],
  'tickets.work': ['staff', 'admin', 'owner'],
  'errors.view': ['staff', 'admin', 'owner'],
  'users.edit': ['admin', 'owner'],
  'comms.send': ['admin', 'owner'],
  'audit.view': ['admin', 'owner'],
  'analytics.view': ['admin', 'owner'],
  'roles.assign': ['owner'],
};

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function can(role: StaffRole | null | undefined, permission: Permission): boolean {
  return !!role && ALLOWED[permission].includes(role);
}

export function gateStatus(
  signedIn: boolean,
  role: StaffRole | null | undefined,
  permission: Permission,
): 200 | 401 | 403 {
  if (!signedIn) return 401;
  return can(role, permission) ? 200 : 403;
}

export function isBanned(bannedUntil: string | null | undefined, now: Date): boolean {
  if (!bannedUntil) return false;
  const t = Date.parse(bannedUntil);
  return !Number.isFinite(t) || t > now.getTime();
}

export type SuspendBlock = 'self' | 'owner' | 'role_holder';

export const SUSPEND_REFUSED: Record<SuspendBlock, string> = {
  self: 'You cannot suspend your own account.',
  owner: 'Owner accounts cannot be suspended.',
  role_holder: 'Only an Owner can suspend someone who holds a role.',
};

/** Returns why this suspension is refused, or null when it is allowed. */
export function canSuspend(input: {
  actorId: string;
  actorRole: StaffRole;
  targetId: string;
  targetRole: StaffRole | null;
}): SuspendBlock | null {
  if (input.actorId === input.targetId) return 'self';
  if (input.targetRole === 'owner') return 'owner';
  if (input.targetRole && input.actorRole !== 'owner') return 'role_holder';
  return null;
}
