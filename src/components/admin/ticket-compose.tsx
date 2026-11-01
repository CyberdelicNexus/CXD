'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AdminRequestError, adminPost } from '@/lib/admin/client';

export function TicketCompose({ ticketId, email }: { ticketId: string; email: string }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // One key per draft: a retry of the same text reuses it, so the server sends the email once.
  const replyKey = useRef<string | null>(null);

  function done() {
    setText('');
    replyKey.current = null;
    router.refresh();
  }

  async function submit(path: 'notes' | 'reply') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (path === 'reply') {
        replyKey.current ??= crypto.randomUUID();
        await adminPost(`/api/admin/support/${ticketId}/reply`, { body: text, idempotencyKey: replyKey.current });
      } else {
        await adminPost(`/api/admin/support/${ticketId}/notes`, { body: text });
      }
      done();
    } catch (err) {
      if (err instanceof AdminRequestError && err.data.sent === true) {
        // The email went out; only the card update failed. Treat the draft as sent.
        done();
        setNotice(err.message);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor="compose" className="text-sm text-white/60">Note or reply</label>
      <Textarea
        id="compose"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          // Different text is a different reply, so it gets its own key.
          replyKey.current = null;
        }}
        className="bg-white/5 border-white/10 min-h-28"
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy || !text.trim()} onClick={() => submit('notes')}>
          Save internal note
        </Button>
        <Button size="sm" disabled={busy || !text.trim()} onClick={() => submit('reply')}>
          Email reply to {email}
        </Button>
      </div>
      {notice && <p role="status" className="text-sm text-amber-300">{notice}</p>}
      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}
