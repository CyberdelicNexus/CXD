import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { isUuid, notFoundResponse, parseBody } from '@/lib/admin/http';

type Ctx = { params: { id: string } };

const schema = z.object({ body: z.string().trim().min(1).max(10000) });

export async function POST(request: Request, context: Ctx) {
  const gate = await requirePermission('tickets.work');
  if (!gate.ok) return gate.response;
  if (!isUuid(context.params.id)) return notFoundResponse();
  const body = await parseBody(request, schema);
  if (!body.ok) return body.response;

  const { error } = await getSupabaseAdmin().from('support_ticket_events').insert({
    ticket_id: context.params.id,
    actor_id: gate.staff.userId,
    kind: 'note',
    body: body.data.body,
  });
  if (error) {
    // A missing card breaks the foreign key; anything else is a real failure.
    if (error.code === '23503') return NextResponse.json({ error: 'Card not found.' }, { status: 404 });
    // Code and message only: details can echo the note text.
    Sentry.captureException(new Error(`admin support note failed: ${error.code ?? 'error'}: ${error.message}`), {
      tags: { route: 'admin-support-note' },
    });
    return NextResponse.json({ error: 'The note was not saved.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
