'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * The recovery token arrives in the URL fragment, so it never reaches a server
 * log or a Sentry request URL. Read it once, keep it in a hidden input, and
 * take it out of the address bar straight away.
 */
export function RecoveryForm() {
  const [token, setToken] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    setToken(params.get('token_hash') ?? '');
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  return (
    <form action="/auth/recovery/confirm" method="POST" className="max-w-md space-y-4 text-center">
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <input type="hidden" name="token_hash" value={token} />
      <Button type="submit" disabled={!token}>Continue</Button>
    </form>
  );
}
