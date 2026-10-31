'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AdminRequestError, adminPost } from '@/lib/admin/client';
import { IN_APP_BODY_MAX } from '@/lib/admin/comms-limits';

const FIELD = 'h-9 w-full rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Preview {
  inAppCount: number;
  emailCount: number;
  problem: string | null;
}

/** True when the request may have reached the server's insert, so the key may be used up. */
function outcomeUnknown(err: unknown): boolean {
  if (!(err instanceof AdminRequestError)) return true; // the connection dropped
  if (typeof err.data.broadcastId === 'string' || err.data.duplicate === true) return true;
  // A server error with no JSON body says nothing about what happened.
  return err.status >= 500 && Object.keys(err.data).length === 0;
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
  // After a send that failed or may have gone out, the form stays locked. Editing and
  // pressing Send again would make a second broadcast to the same people.
  const [locked, setLocked] = useState(false);
  // One key per draft. It rotates only after a success or a deliberate new message.
  const sendKey = useRef<string | null>(null);
  // Stops a double click before the disabled state has rendered.
  const inFlight = useRef(false);

  const { payload, ignoredIds } = useMemo(() => {
    const tokens = userIds.split(/[\s,]+/).filter(Boolean);
    const valid = tokens.filter((value) => UUID.test(value));
    const ids = Array.from(new Set(valid));
    const audience =
      audienceKind === 'plan' ? { kind: 'plan', plan }
      : audienceKind === 'users' ? { kind: 'users', userIds: ids }
      : { kind: 'all' };
    return {
      ignoredIds: tokens.length - valid.length,
      payload: {
        channels: [...(inApp ? ['in_app'] : []), ...(email ? ['email'] : [])],
        category,
        audience,
        subject: subject.trim(),
        body: body.trim(),
      },
    };
  }, [inApp, email, category, audienceKind, plan, userIds, subject, body]);

  // A response for an older version of the form must not be applied to the current one.
  const payloadJson = JSON.stringify(payload);
  const currentPayload = useRef(payloadJson);
  currentPayload.current = payloadJson;

  function changed() {
    setPreview(null);
    setTestToken('');
    setConfirmText('');
    setMessage(null);
  }

  function startNew() {
    changed();
    setSubject('');
    setBody('');
    setUserIds('');
    setLocked(false);
    sendKey.current = null;
    router.refresh();
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
    if (inFlight.current || !preview) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    sendKey.current ??= crypto.randomUUID();
    try {
      await adminPost('/api/admin/comms/send', {
        ...payload,
        idempotencyKey: sendKey.current,
        confirmCount: email ? preview.emailCount : undefined,
        confirmInAppCount: inApp ? preview.inAppCount : undefined,
        testToken: testToken || undefined,
      });
      changed();
      setSubject('');
      setBody('');
      sendKey.current = null;
      setMessage({ ok: true, text: 'Queued. Delivery counts update in the history below.' });
      router.refresh();
    } catch (err) {
      if (outcomeUnknown(err)) {
        // The key is kept and the form locked: another send of the same draft is refused
        // as "already sent", and an edited draft cannot start a second broadcast.
        setLocked(true);
        const known = err instanceof AdminRequestError && typeof err.data.error === 'string';
        setMessage({
          ok: false,
          text: known
            ? (err as Error).message
            : 'It is not known whether this went out. Check the history below before doing anything else.',
        });
        router.refresh();
      } else {
        setMessage({ ok: false, text: (err as Error).message });
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const bodyTooLong = inApp && body.trim().length > IN_APP_BODY_MAX;
  const ready = payload.channels.length > 0 && !!payload.subject && !!payload.body && !bodyTooLong;
  const count = preview?.emailCount ?? 0;
  const reach = preview ? preview.inAppCount + preview.emailCount : 0;
  const canSend =
    !!preview && !preview.problem && reach > 0 && !locked && (!email || (!!testToken && confirmText === String(count)));

  return (
    <div className="space-y-4 rounded-lg border border-white/10 p-4">
      {locked && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-rose-500/10 p-3 text-sm text-rose-300">
          <span>This message is locked because it may already have gone out. Read the history before writing another.</span>
          <Button size="sm" variant="outline" onClick={startNew}>Start a new message</Button>
        </div>
      )}
      <fieldset disabled={locked || busy} className="space-y-4 border-0 p-0 m-0 min-w-0">
        <div className="flex gap-4 text-sm">
          <span className="text-white/60">Channel</span>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={inApp} onChange={(e) => { setInApp(e.target.checked); changed(); }} /> In-app
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={email} onChange={(e) => { setEmail(e.target.checked); changed(); }} /> Email
          </label>
        </div>

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
          <input id="subject" className={FIELD} value={subject} maxLength={200} onChange={(e) => { setSubject(e.target.value); changed(); }} />
        </div>
        <div className="space-y-1">
          <label htmlFor="body" className="text-sm text-white/60">Message (blank line starts a new paragraph)</label>
          <Textarea id="body" className="bg-white/5 border-white/10 min-h-40" value={body} onChange={(e) => { setBody(e.target.value); changed(); }} />
          {inApp && (
            <p className={`text-xs ${bodyTooLong ? 'text-rose-400' : 'text-white/40'}`} aria-live="polite">
              {body.trim().length} / {IN_APP_BODY_MAX} characters for in-app
            </p>
          )}
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={!ready || (audienceKind === 'users' && (payload.audience as { userIds: string[] }).userIds.length === 0)}
          onClick={() => run(async () => {
            const sent = payloadJson;
            const result = await adminPost<Preview>('/api/admin/comms/preview', payload);
            // The form changed while this was loading, so these counts describe something else.
            if (currentPayload.current === sent) setPreview(result);
          })}
        >
          Check recipients
        </Button>
      </fieldset>

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
                disabled={busy || locked}
                onClick={() => run(async () => {
                  const sent = payloadJson;
                  const result = await adminPost<{ testToken: string }>('/api/admin/comms/test', payload);
                  // A token for older content would be refused at send time; do not keep it.
                  if (currentPayload.current !== sent) return;
                  setTestToken(result.testToken);
                  setMessage({ ok: true, text: 'Test sent to your own email.' });
                })}
              >
                {testToken ? 'Send another test' : 'Send test to myself'}
              </Button>
              {testToken && (
                <div className="space-y-1">
                  <label htmlFor="confirm" className="text-white/60">Type {count} to confirm. A sent email cannot be recalled.</label>
                  <input id="confirm" inputMode="numeric" className={FIELD} value={confirmText} disabled={locked} onChange={(e) => setConfirmText(e.target.value)} />
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
