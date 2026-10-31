import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { parseBody, rpcError } from '@/lib/admin/http';
import { ADMIN_PLANS } from '@/lib/admin/plan-guard';

type Ctx = { params: { id: string } };

const schema = z.object({
  plan: z.enum(ADMIN_PLANS),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: Request, context: Ctx) {
  const gate = await requirePermission('users.edit');
  if (!gate.ok) return gate.response;
  const body = await parseBody(request, schema);
  if (!body.ok) return body.response;

  const { error } = await getSupabaseAdmin().rpc('admin_set_plan', {
    p_actor: gate.staff.userId,
    p_target: context.params.id,
    p_plan: body.data.plan,
    p_reason: body.data.reason,
  });
  if (error) return rpcError(error);
  return NextResponse.json({ ok: true });
}
