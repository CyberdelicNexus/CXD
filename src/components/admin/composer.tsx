'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AdminRequestError, adminPost } from '@/lib/admin/client';

const FIELD = 'h-9 w-full rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Preview {
  inAppCount: number;
  emailCount: number;
  problem: string | null;
}

export function Composer() {
  const router = useRouter();
  const [inApp, setInApp] = useState(true);
  const [email, setEmail] = useState(false);
  const [category, setCategory] = useState<'product' | 'service'>('product');
  const [audienceKind, setAudienceKind] = useState<'all' | 'plan' | 'users'>('all');
  const [plan, setPlan] = useState('free');
  const [userIds, setUserIds] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [testToken, setTestToken] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // One key per draft. A retry or a second click reuses it, so the server sends the
  // broadcast once and answers the repeat with "already sent". It rotates only after a
  // success or when the content changes. A failed or unknown send keeps it.
  const sendKey = useRef<string | null>(null);
  // Stops a double click before the disabled state has rendered.
  const inFlight = useRef(false);

  const { payload, ignoredIds } = useMemo(() => {
    const tokens = userIds.split(/[\s,]+/).filter(Boolean);
    const ids = Array.from(new Set(tokens.filter((value) => UUID.test(value))));
    const audience =
      audienceKind === 'plan' ? { kind: 'plan', plan }
      : audienceKind === 'users' ? { kind: 'users', userIds: ids }
      : { kind: 'all' };
    return {
      ignoredIds: tokens.length - tokens.filter((value) => UUID.test(value)).length,
      payload: {
        channels: [...(inApp ? ['in_app'] : []), ...(email ? ['email'] : [])],
        category,
        audience,
        subject: subject.trim(),
        body: body.trim(),
      },
    };
  }, [inApp, email, category, audienceKind, plan, userIds, subject, body]);

  function changed() {
    setPreview(null);
    setTestToken('');
    setConfirmText('');
    setMessage(null);
    // Different content is a different broadcast, so it gets its own key.
    sendKey.current = null;
  }

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function send() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    sendKey.current ??= crypto.randomUUID();
    try {
      await adminPost('/api/admin/comms/send', {
        ...payload,
        idempotencyKey: sendKey.current,
        confirmCount: email ? count : undefined,
        testToken: testToken || undefined,
      });
      changed();
      setSubject('');
      setBody('');
      setMessage({ ok: true, text: 'Sent. Delivery counts update in the history below.' });
      router.refresh();
    } catch (err) {
      // The key is kept on purpose: another click returns "already sent" instead of sending twice.
      if (err instanceof AdminRequestError) {
        setMessage({ ok: false, text: err.message });
        // A partial send has a history row; show it.
        if (typeof err.data.broadcastId === 'string') router.refresh();
      } else {
        setMessage({
          ok: false,
          text: 'The connection dropped, so it is not known whether this went out. Check the history below before sending again.',
        });
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const ready = payload.channels.length > 0 && !!payload.subject && !!payload.body;
  const count = preview?.emailCount ?? 0;
  const reach = preview ? preview.inAppCount + preview.emailCount : 0;
  const canSend =
    !!preview && !preview.problem && reach > 0 && (!email || (!!testToken && confirmText === String(count)));

  return (
    <div className="space-y-4 rounded-lg border border-white/10 p-4">
      <fieldset className="flex gap-4 text-sm">
        <legend className="mb-1 text-white/60">Channel</legend>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={inApp} onChange={(e) => { setInApp(e.target.checked); changed(); }} /> In-app
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={email} onChange={(e) => { setEmail(e.target.checked); changed(); }} /> Email
        </label>
      </fieldset>

      {email && (
        <div className="space-y-1">
          <label htmlFor="category" className="text-sm text-white/60">Email category</label>
          <select id="category" className={FIELD} value={category} onChange={(e) => { setCategory(e.target.value as 'product' | 'service'); changed(); }}>
            <option value="product">Product update (skips unsubscribed users)</option>
            <option value="service">Service notice (reaches everyone)</option>
          </select>
          {category === 'service' && (
            <p className="text-xs text-amber-300">Essential messages only, such as an outage or terms change. Never use this to promote anything.</p>
          )}
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="audience" className="text-sm text-white/60">Audience</label>
        <select id="audience" className={FIELD} value={audienceKind} onChange={(e) => { setAudienceKind(e.target.value as 'all' | 'plan' | 'users'); changed(); }}>
          <option value="all">Everyone</option>
          <option value="plan">One plan</option>
          <option value="users">Chosen users</option>
        </select>
        {audienceKind === 'plan' && (
          <select aria-label="Plan" className={FIELD} value={plan} onChange={(e) => { setPlan(e.target.value); changed(); }}>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="lifetime">Lifetime</option>
            <option value="beta_tester">Beta tester</option>
          </select>
        )}
        {audienceKind === 'users' && (
          <>
            <Textarea
              aria-label="User IDs"
              placeholder="Paste user IDs from their user pages, separated by spaces or commas"
              value={userIds}
              onChange={(e) => { setUserIds(e.target.value); changed(); }}
              className="bg-white/5 border-white/10"
            />
            {ignoredIds > 0 && (
              <p role="alert" className="text-xs text-amber-300">
                {ignoredIds} {ignoredIds === 1 ? 'entry is' : 'entries are'} not a valid user ID and will be ignored.
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="subject" className="text-sm text-white/60">Subject</label>
        <input id="subject" className={FIELD} value={subject} onChange={(e) => { setSubject(e.target.value); changed(); }} />
      </div>
      <div className="space-y-1">
        <label htmlFor="body" className="text-sm text-white/60">Message (blank line starts a new paragraph)</label>
        <Textarea id="body" className="bg-white/5 border-white/10 min-h-40" value={body} onChange={(e) => { setBody(e.target.value); changed(); }} />
      </div>

      <Button
        size="sm"
        variant="outline"
        disabled={busy || !ready || (audienceKind === 'users' && (payload.audience as { userIds: string[] }).userIds.length === 0)}
        onClick={() => run(async () => setPreview(await adminPost<Preview>('/api/admin/comms/preview', payload)))}
      >
        Check recipients
      </Button>

      {preview && (
        <div className="space-y-3 rounded-md bg-white/[0.03] p-3 text-sm">
          <p>{inApp ? `${preview.inAppCount} in-app` : ''}{inApp && email ? ' · ' : ''}{email ? `${preview.emailCount} emails` : ''}</p>
          {reach === 0 && <p role="alert" className="text-amber-300">No one matches this audience on the chosen channels.</p>}
          {preview.problem && <p role="alert" className="text-rose-400">{preview.problem}</p>}
          {email && !preview.problem && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => run(async () => {
                  const result = await adminPost<{ testToken: string }>('/api/admin/comms/test', payload);
                  setTestToken(result.testToken);
                  setMessage({ ok: true, text: 'Test sent to your own email.' });
                })}
              >
                {testToken ? 'Send another test' : 'Send test to myself'}
              </Button>
              {testToken && (
                <div className="space-y-1">
                  <label htmlFor="confirm" className="text-white/60">Type {count} to confirm. A sent email cannot be recalled.</label>
                  <input id="confirm" inputMode="numeric" className={FIELD} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
                </div>
              )}
            </>
          )}
          <Button size="sm" disabled={busy || !canSend} onClick={send}>
            Send
          </Button>
        </div>
      )}

      {message && <p role="status" className={`text-sm ${message.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{message.text}</p>}
    </div>
  );
}
