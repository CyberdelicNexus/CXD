'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { adminPost } from '@/lib/admin/client';

export function TicketCompose({ ticketId, email }: { ticketId: string; email: string }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(path: 'notes' | 'reply') {
    setBusy(true);
    setError('');
    try {
      await adminPost(`/api/admin/support/${ticketId}/${path}`, { body: text });
      setText('');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor="compose" className="text-sm text-white/60">Note or reply</label>
      <Textarea id="compose" value={text} onChange={(e) => setText(e.target.value)} className="bg-white/5 border-white/10 min-h-28" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy || !text.trim()} onClick={() => submit('notes')}>
          Save internal note
        </Button>
        <Button size="sm" disabled={busy || !text.trim()} onClick={() => submit('reply')}>
          Email reply to {email}
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}
