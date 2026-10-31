import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { isUuid, notFoundResponse, parseBody, rpcError } from '@/lib/admin/http';

type Ctx = { params: { id: string } };

const schema = z.object({
  amount: z.number().int().min(-100000).max(100000).refine((n) => n !== 0),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(request: Request, context: Ctx) {
  const gate = await requirePermission('users.edit');
  if (!gate.ok) return gate.response;
  if (!isUuid(context.params.id)) return notFoundResponse();
  const body = await parseBody(request, schema);
  if (!body.ok) return body.response;

  const { data, error } = await getSupabaseAdmin().rpc('admin_adjust_credits', {
    p_actor: gate.staff.userId,
    p_target: context.params.id,
    p_amount: body.data.amount,
    p_reason: body.data.reason,
  });
  if (error) return rpcError(error);
  return NextResponse.json({ ok: true, addonCredits: data });
}
