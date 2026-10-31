import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { withAudit } from '@/lib/admin/audit';
import { isUuid, notFoundResponse, parseBody } from '@/lib/admin/http';
import { canSuspend, SUSPEND_REFUSED, type StaffRole } from '@/lib/admin/permissions';
import { getTargetRole } from '@/lib/admin/users';

type Ctx = { params: { id: string } };

// Supabase has no permanent ban; 100 years stands in for one until restored.
const SUSPENDED = '876000h';

const schema = z.object({
  suspended: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: Request, context: Ctx) {
  const gate = await requirePermission('users.edit');
  if (!gate.ok) return gate.response;
  if (!isUuid(context.params.id)) return notFoundResponse();
  const body = await parseBody(request, schema);
  if (!body.ok) return body.response;
  const targetId = context.params.id;

  // A failed role lookup must never read as "no role", or a suspension could slip through.
  let targetRole: StaffRole | null;
  try {
    targetRole = await getTargetRole(targetId);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'admin-suspend', step: 'role-lookup' } });
    return NextResponse.json({ error: 'The account was not changed.' }, { status: 500 });
  }

  const block = canSuspend({
    actorId: gate.staff.userId,
    actorRole: gate.staff.role,
    targetId,
    targetRole,
  });
  if (block) return NextResponse.json({ error: SUSPEND_REFUSED[block] }, { status: 409 });

  try {
    await withAudit(
      {
        actorId: gate.staff.userId,
        action: body.data.suspended ? 'user.suspend' : 'user.restore',
        targetType: 'user',
        targetId,
        reason: body.data.reason,
      },
      async () => {
        const { error } = await getSupabaseAdmin().auth.admin.updateUserById(targetId, {
          ban_duration: body.data.suspended ? SUSPENDED : 'none',
        });
        if (error) throw error;
      },
    );
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'admin-suspend', step: 'update' } });
    return NextResponse.json({ error: 'The account was not changed.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
