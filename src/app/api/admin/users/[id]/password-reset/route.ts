import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { render } from '@react-email/render';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { withAudit } from '@/lib/admin/audit';
import { isUuid, notFoundResponse } from '@/lib/admin/http';
import { getTargetRole } from '@/lib/admin/users';
import { sendEmail } from '@/lib/email';
import PasswordReset from '@emails/password-reset';

type Ctx = { params: { id: string } };

export async function POST(_request: Request, context: Ctx) {
  const gate = await requirePermission('users.edit');
  if (!gate.ok) return gate.response;
  if (!isUuid(context.params.id)) return notFoundResponse();
  const targetId = context.params.id;
  const admin = getSupabaseAdmin();

  const { data, error: lookupError } = await admin.auth.admin.getUserById(targetId);
  if (lookupError && lookupError.status !== 404) {
    Sentry.captureException(new Error(`password reset lookup failed: ${lookupError.message}`), {
      tags: { route: 'admin-password-reset', step: 'user-lookup' },
    });
    return NextResponse.json({ error: 'The user could not be looked up.' }, { status: 500 });
  }
  const email = data?.user?.email;
  if (!email) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  // Resetting a staff member's password hands over their session, so only an Owner may do it.
  let targetRole;
  try {
    targetRole = await getTargetRole(targetId);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'admin-password-reset', step: 'role-lookup' } });
    return NextResponse.json({ error: 'The reset email could not be sent.' }, { status: 500 });
  }
  if (targetRole && gate.staff.role !== 'owner') {
    return NextResponse.json({ error: 'Only an Owner can reset the password of someone who holds a role.' }, { status: 409 });
  }

  try {
    await withAudit(
      { actorId: gate.staff.userId, action: 'user.password_reset', targetType: 'user', targetId },
      async () => {
        const { data: link, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
        const hashed = link?.properties?.hashed_token;
        if (error || !hashed) throw error ?? new Error('no recovery token');
        // The token sits in the fragment so it never reaches a server log or Sentry URL.
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design';
        const resetUrl = `${baseUrl}/auth/recovery#token_hash=${encodeURIComponent(hashed)}`;
        await sendEmail({
          to: email,
          subject: 'Reset your CXD Canvas password',
          html: await render(PasswordReset({ resetUrl })),
        });
      },
    );
  } catch (err) {
    // Message only: the error object may carry request details, and the token must never be reported.
    Sentry.captureException(new Error(`password reset failed: ${err instanceof Error ? err.message : 'unknown'}`), {
      tags: { route: 'admin-password-reset', step: 'send' },
    });
    return NextResponse.json({ error: 'The reset email could not be sent.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
