import { NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';

function redirectTo(request: Request, path: string): NextResponse {
  // 303 so the browser follows the redirect with GET.
  const res = NextResponse.redirect(new URL(path, new URL(request.url).origin), 303);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  return res;
}

/** Only a form posted from this site may spend the token. */
function isSameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return redirectTo(request, '/forgot-password');

  let tokenHash: FormDataEntryValue | null = null;
  try {
    tokenHash = (await request.formData()).get('token_hash');
  } catch {
    return redirectTo(request, '/forgot-password');
  }

  if (typeof tokenHash === 'string' && tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    if (!error) return redirectTo(request, '/dashboard/reset-password');
  }
  return redirectTo(request, '/forgot-password');
}
