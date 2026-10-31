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
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const value = params.get('token_hash');
    // React StrictMode runs this twice in dev; the second run finds the fragment
    // already removed and must leave the stored token alone.
    if (value) {
      setToken(value);
      window.history.replaceState(null, '', window.location.pathname);
    }
    setChecked(true);
  }, []);

  return (
    <form action="/auth/recovery/confirm" method="POST" className="max-w-md space-y-4 text-center">
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <input type="hidden" name="token_hash" value={token} />
      {token ? (
        <Button type="submit">Continue</Button>
      ) : (
        checked && <p className="text-sm text-white/60">This link is incomplete. Open it again from your email.</p>
      )}
    </form>
  );
}
