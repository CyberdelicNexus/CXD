import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { isUuid, notFoundResponse, parseBody, rpcError } from '@/lib/admin/http';
import { ASSIGNABLE_ROLES } from '@/lib/admin/permissions';

type Ctx = { params: { id: string } };

const schema = z.object({
  role: z.enum(ASSIGNABLE_ROLES).nullable(),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: Request, context: Ctx) {
  const gate = await requirePermission('roles.assign');
  if (!gate.ok) return gate.response;
  if (!isUuid(context.params.id)) return notFoundResponse();
  const body = await parseBody(request, schema);
  if (!body.ok) return body.response;

  const { error } = await getSupabaseAdmin().rpc('admin_set_role', {
    p_actor: gate.staff.userId,
    p_target: context.params.id,
    p_role: body.data.role,
    p_reason: body.data.reason,
  });
  if (error) return rpcError(error);
  return NextResponse.json({ ok: true });
}
