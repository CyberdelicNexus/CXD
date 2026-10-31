import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { withAudit } from '@/lib/admin/audit';
import { parseBody } from '@/lib/admin/http';
import { canSuspend } from '@/lib/admin/permissions';
import { getTargetRole } from '@/lib/admin/users';

type Ctx = { params: { id: string } };

// Supabase has no permanent ban; 100 years stands in for one until restored.
const SUSPENDED = '876000h';

const REFUSED = {
  self: 'You cannot suspend your own account.',
  owner: 'Owner accounts cannot be suspended.',
  role_holder: 'Only an Owner can suspend someone who holds a role.',
};

const schema = z.object({
  suspended: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: Request, context: Ctx) {
  const gate = await requirePermission('users.edit');
  if (!gate.ok) return gate.response;
  const body = await parseBody(request, schema);
  if (!body.ok) return body.response;
  const targetId = context.params.id;

  const block = canSuspend({
    actorId: gate.staff.userId,
    actorRole: gate.staff.role,
    targetId,
    targetRole: await getTargetRole(targetId),
  });
  if (block) return NextResponse.json({ error: REFUSED[block] }, { status: 409 });

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
  } catch {
    return NextResponse.json({ error: 'The account was not changed.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
