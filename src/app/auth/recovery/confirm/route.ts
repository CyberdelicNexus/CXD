import { NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';

export async function POST(request: Request) {
  const form = await request.formData();
  const tokenHash = form.get('token_hash');
  const origin = new URL(request.url).origin;

  if (typeof tokenHash === 'string' && tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    // 303 so the browser follows the redirect with GET.
    if (!error) return NextResponse.redirect(new URL('/dashboard/reset-password', origin), 303);
  }
  return NextResponse.redirect(new URL('/forgot-password', origin), 303);
}
