'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  async function unsubscribe() {
    setState('busy');
    const response = await fetch(`/api/email/unsubscribe?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => null);
    setState(response?.ok ? 'done' : 'error');
  }

  if (state === 'done') {
    return <p role="status">You are unsubscribed from product updates. You will still get essential account emails.</p>;
  }
  return (
    <div className="space-y-2">
      <Button disabled={state === 'busy'} onClick={unsubscribe}>Unsubscribe from product updates</Button>
      {state === 'error' && <p role="alert" className="text-sm text-rose-400">That did not work. Please try again.</p>}
    </div>
  );
}
