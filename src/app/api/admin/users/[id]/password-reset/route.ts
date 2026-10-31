import { NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePermission } from '@/lib/admin/gate';
import { withAudit } from '@/lib/admin/audit';
import { sendEmail } from '@/lib/email';
import PasswordReset from '@emails/password-reset';

type Ctx = { params: { id: string } };

export async function POST(_request: Request, context: Ctx) {
  const gate = await requirePermission('users.edit');
  if (!gate.ok) return gate.response;
  const targetId = context.params.id;
  const admin = getSupabaseAdmin();

  const { data } = await admin.auth.admin.getUserById(targetId);
  const email = data.user?.email;
  if (!email) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  try {
    await withAudit(
      { actorId: gate.staff.userId, action: 'user.password_reset', targetType: 'user', targetId },
      async () => {
        const { data: link, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
        const hashed = link?.properties?.hashed_token;
        if (error || !hashed) throw error ?? new Error('no recovery token');
        const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/recovery?token_hash=${encodeURIComponent(hashed)}`;
        await sendEmail({
          to: email,
          subject: 'Reset your CXD Canvas password',
          html: await render(PasswordReset({ resetUrl })),
        });
      },
    );
  } catch {
    return NextResponse.json({ error: 'The reset email could not be sent.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
