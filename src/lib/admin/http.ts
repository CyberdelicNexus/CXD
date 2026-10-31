import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import type { z } from 'zod';

export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, response: NextResponse.json({ error: 'Invalid request' }, { status: 400 }) };
}

const RPC_MESSAGES: Record<string, string> = {
  not_permitted: 'You do not have permission to do that.',
  owner_protected: 'Owner accounts cannot be changed here.',
  invalid_role: 'That role is not valid.',
  no_subscription: 'This user has no subscription record.',
  no_change: 'The user is already on that plan.',
  stripe_managed: 'This plan is managed by Stripe.',
  nexus_managed: 'This plan is managed by Cyberdelic Nexus.',
  lifetime_plan: 'Lifetime plans cannot be changed here.',
  invalid_plan: 'That plan is not valid.',
  no_credit_record: 'This user has no credit record.',
  negative_balance: 'That would take the balance below zero.',
};

/** Maps a RAISE EXCEPTION code from an admin RPC to a readable 409. */
export function rpcError(error: { message?: string }): NextResponse {
  const message = RPC_MESSAGES[error.message ?? ''];
  if (message) return NextResponse.json({ error: message }, { status: 409 });
  // Unmapped: report the database message (an error code or text, never a payload).
  Sentry.captureException(new Error(`admin rpc failed: ${error.message ?? 'unknown'}`), {
    tags: { route: 'admin-rpc' },
  });
  return NextResponse.json({ error: 'The action failed. Nothing was changed.' }, { status: 500 });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** The 404 an /api/admin/users/[id] route returns for an id that is not a UUID. */
export function notFoundResponse(): NextResponse {
  return NextResponse.json({ error: 'Not found.' }, { status: 404 });
}
