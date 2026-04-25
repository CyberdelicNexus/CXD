# Email Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 of CXD's automated email system — trial lifecycle emails (day 1, ending soon, converted) + payment dunning (failed, final warning) + the missing Stripe webhook handlers so trial→paid auto-flips in Supabase.

**Architecture:** Event-driven emails via extensions to the existing Stripe webhook handler in `src/app/api/webhooks/stripe/route.ts`. Time-driven emails via a new Vercel Cron route at `src/app/api/cron/email-scheduler/route.ts` running daily at 14:00 UTC. Idempotency guaranteed by a new `email_log` Supabase table. Five new React Email templates in `emails/` follow the existing `EmailLayout` + `EmailCard` + `EmailButton` pattern.

**Tech Stack:** Next.js 14 (App Router), Supabase (Postgres + Auth), Stripe subscriptions, Resend for email, React Email for templates, Vercel Cron for scheduling.

---

## File Structure

**Create:**
- `supabase/migrations/20240424000001_email_log.sql` — idempotency tracking table
- `emails/trial-day-1.tsx`
- `emails/trial-ending-soon.tsx`
- `emails/trial-converted.tsx`
- `emails/payment-failed.tsx`
- `emails/payment-final-warning.tsx`
- `src/lib/email-kinds.ts` — shared constants and a single `sendKindOnce` helper that encapsulates the "render → check email_log → sendEmail → insert log" flow so the webhook and cron stay dry
- `src/app/api/cron/email-scheduler/route.ts` — daily scheduled scans

**Modify:**
- `src/app/api/webhooks/stripe/route.ts` — add four new `switch` cases (`customer.subscription.updated`, `customer.subscription.trial_will_end`, `invoice.paid`, `invoice.payment_failed`)
- `vercel.json` — add cron schedule + give the new route its own function config

**No modification** to existing templates (`welcome.tsx`, `subscription-confirmed.tsx`, `subscription-cancelled.tsx`, `credit-purchase-receipt.tsx`, etc.) or the `lib/email.ts` sender itself.

---

## Task 1: Supabase `email_log` migration

**Files:**
- Create: `supabase/migrations/20240424000001_email_log.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Email log for idempotency-guarded automated emails.
-- Every automated send inserts one row; handlers check for existing rows
-- before sending so cron re-runs and webhook retries never double-send.

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_kind text not null,
  sent_at timestamptz not null default now(),
  stripe_event_id text,
  metadata jsonb
);

create index if not exists email_log_user_kind_idx
  on public.email_log(user_id, email_kind);

create index if not exists email_log_stripe_event_idx
  on public.email_log(stripe_event_id)
  where stripe_event_id is not null;

-- Service-role only. Clients never read or write this table directly.
alter table public.email_log enable row level security;

-- No policies for anon/authenticated — service role bypasses RLS by default.
-- Leaving RLS on with no policies means only service role clients can access.
```

- [ ] **Step 2: Apply the migration to the local Supabase instance**

Run from `CXD/`:

```bash
npx supabase db push
```

Expected: success message listing the applied migration. If the Supabase CLI is not linked to a project, the engineer may need to run `npx supabase link --project-ref <ref>` first (use the user's Supabase project ref — ask if unsure).

- [ ] **Step 3: Verify the table exists**

```bash
npx supabase db dump --data-only --local --table public.email_log | head
```

Expected: empty-set result (table exists but has no rows yet).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20240424000001_email_log.sql
git commit -m "feat(db): add email_log table for automated-email idempotency"
```

---

## Task 2: Shared helper — `src/lib/email-kinds.ts`

**Files:**
- Create: `src/lib/email-kinds.ts`

This centralizes the email-kind string union, the idempotency-guarded send helper, and avoids duplicating the `render → check email_log → sendEmail → insert email_log` pattern across every webhook case and cron scan.

- [ ] **Step 1: Create the helper file**

```ts
import type { ReactElement } from 'react';
import { render } from '@react-email/render';
import { createClient as createAdminClient, SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

/**
 * Stable identifiers for every automated email. These strings are persisted in
 * email_log.email_kind — never rename without a migration.
 */
export const EMAIL_KINDS = {
  TRIAL_DAY_1: 'trial-day-1',
  TRIAL_ENDING_SOON: 'trial-ending-soon',
  TRIAL_CONVERTED: 'trial-converted',
  PAYMENT_FAILED: 'payment-failed',
  PAYMENT_FINAL_WARNING: 'payment-final-warning',
} as const;

export type EmailKind = typeof EMAIL_KINDS[keyof typeof EMAIL_KINDS];

function adminClient(): SupabaseClient {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

interface SendKindOnceOptions {
  userId: string;
  userEmail: string;
  kind: EmailKind;
  subject: string;
  template: ReactElement;
  /** For webhook-triggered sends, pass the Stripe event id for stronger idempotency. */
  stripeEventId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Idempotent email send. Returns true if the email was sent this invocation;
 * false if it was skipped because email_log already has a matching row. Never
 * throws — failures are logged and reported via the boolean.
 */
export async function sendKindOnce(opts: SendKindOnceOptions): Promise<boolean> {
  const supabase = adminClient();

  // Idempotency check. Either an existing (user, kind) row OR a matching
  // stripe_event_id (when provided) means we already processed this send.
  const orFilter = opts.stripeEventId
    ? `and(user_id.eq.${opts.userId},email_kind.eq.${opts.kind}),stripe_event_id.eq.${opts.stripeEventId}`
    : `and(user_id.eq.${opts.userId},email_kind.eq.${opts.kind})`;

  const { data: existing } = await supabase
    .from('email_log')
    .select('id')
    .or(orFilter)
    .limit(1)
    .maybeSingle();

  if (existing) {
    console.log(`[email] Skipped ${opts.kind} for user=${opts.userId} — already sent`);
    return false;
  }

  const html = await render(opts.template);

  try {
    await sendEmail({ to: opts.userEmail, subject: opts.subject, html });
  } catch (err) {
    console.error(`[email] Failed to send ${opts.kind} for user=${opts.userId}:`, err);
    return false;
  }

  const { error: logErr } = await supabase.from('email_log').insert({
    user_id: opts.userId,
    email_kind: opts.kind,
    stripe_event_id: opts.stripeEventId ?? null,
    metadata: opts.metadata ?? null,
  });

  if (logErr) {
    // The send succeeded; log write failed. Report but don't throw — a
    // duplicate email on next retry is less bad than crashing the webhook.
    console.error(`[email] sendEmail succeeded but email_log insert failed for ${opts.kind}:`, logErr);
  }

  console.log(`[email] Sent ${opts.kind} to user=${opts.userId}`);
  return true;
}
```

- [ ] **Step 2: Type-check**

From `CXD/`:

```bash
npx tsc --noEmit
```

Expected: no new errors from `src/lib/email-kinds.ts`. Pre-existing errors in `src/lib/ai/__tests__/` and `src/utils/__tests__/` are fine to ignore (they exist before this plan).

- [ ] **Step 3: Commit**

```bash
git add src/lib/email-kinds.ts
git commit -m "feat(email): add EMAIL_KINDS registry and sendKindOnce idempotency helper"
```

---

## Task 3: Template — `trial-day-1`

**Files:**
- Create: `emails/trial-day-1.tsx`

- [ ] **Step 1: Write the template**

```tsx
import { Section, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';
import { EmailButton } from './_components/email-button';
import { EmailCard } from './_components/email-card';

interface TrialDay1Props {
  userName: string;
  trialEndDate: string; // e.g. "May 8, 2026"
  dashboardUrl: string;
}

const gettingStartedTips = [
  {
    title: 'Create your first canvas',
    body: 'Start with a blank canvas or pick a template. Drop in notes, tasks, images, or whole boards.',
  },
  {
    title: 'Try the Hypercube',
    body: 'Tag canvas objects to the six faces and ask Cyberdelic Intelligence what patterns it sees.',
  },
  {
    title: 'Invite a collaborator',
    body: 'Live cursors, shared comments, and follow-the-view are all built in. No meeting link required.',
  },
];

export default function TrialDay1({ userName, trialEndDate, dashboardUrl }: TrialDay1Props) {
  return (
    <EmailLayout previewText={`Your Pro trial is live. Runs through ${trialEndDate}.`}>
      <Section style={{ padding: '40px 40px 20px' }}>
        <Heading
          as="h1"
          style={{
            color: '#ffffff',
            fontSize: '28px',
            fontWeight: 700,
            margin: '0 0 12px',
            lineHeight: 1.2,
          }}
        >
          Your Pro trial is live
        </Heading>
        <Text style={{ color: '#c8c4dd', fontSize: '15px', margin: '0 0 24px', lineHeight: 1.6 }}>
          Hi {userName}, welcome to CXD Canvas Pro. Your 14-day trial runs through{' '}
          <strong style={{ color: '#ffffff' }}>{trialEndDate}</strong>. Here are three ways to get
          the most out of it.
        </Text>

        {gettingStartedTips.map((tip, i) => (
          <EmailCard key={i}>
            <Text style={{ color: '#ffffff', fontSize: '15px', fontWeight: 600, margin: '0 0 6px' }}>
              {i + 1}. {tip.title}
            </Text>
            <Text style={{ color: '#9a94b8', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
              {tip.body}
            </Text>
          </EmailCard>
        ))}

        <Section style={{ textAlign: 'center' as const, margin: '32px 0 8px' }}>
          <EmailButton href={dashboardUrl}>Open your dashboard</EmailButton>
        </Section>

        <Text
          style={{ color: '#6b6b7b', fontSize: '12px', margin: '20px 0 0', textAlign: 'center' as const }}
        >
          Questions? Just reply to this email.
        </Text>
      </Section>
    </EmailLayout>
  );
}
```

- [ ] **Step 2: Verify it renders**

Run from `CXD/`:

```bash
npm run email
```

Then open `http://localhost:3001` in a browser, navigate to `trial-day-1`, and confirm the card renders with placeholder values. Close the email dev server when done.

- [ ] **Step 3: Commit**

```bash
git add emails/trial-day-1.tsx
git commit -m "feat(email): add trial-day-1 template"
```

---

## Task 4: Template — `trial-ending-soon`

**Files:**
- Create: `emails/trial-ending-soon.tsx`

- [ ] **Step 1: Write the template**

```tsx
import { Section, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';
import { EmailButton } from './_components/email-button';
import { EmailCard } from './_components/email-card';

interface TrialEndingSoonProps {
  userName: string;
  trialEndDate: string; // e.g. "May 8, 2026"
  cardBrand?: string;
  cardLast4?: string;
  manageBillingUrl: string;
}

export default function TrialEndingSoon({
  userName,
  trialEndDate,
  cardBrand,
  cardLast4,
  manageBillingUrl,
}: TrialEndingSoonProps) {
  const hasCard = Boolean(cardBrand && cardLast4);
  return (
    <EmailLayout previewText={`Your Pro trial ends ${trialEndDate}.`}>
      <Section style={{ padding: '40px 40px 20px' }}>
        <Heading
          as="h1"
          style={{ color: '#ffffff', fontSize: '26px', fontWeight: 700, margin: '0 0 12px', lineHeight: 1.2 }}
        >
          Your Pro trial ends on {trialEndDate}
        </Heading>

        <Text style={{ color: '#c8c4dd', fontSize: '15px', margin: '0 0 24px', lineHeight: 1.6 }}>
          Hi {userName}, your 14-day trial wraps up in a few days. On {trialEndDate} we will
          automatically start your first monthly billing cycle. You will keep full Pro access and
          your next 500 AI credits will be added to your balance.
        </Text>

        <EmailCard>
          <Text style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>
            Payment method on file
          </Text>
          <Text style={{ color: '#9a94b8', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
            {hasCard
              ? `${cardBrand?.toUpperCase()} ending in ${cardLast4}`
              : 'No card on file yet. Add one before the trial ends or your account drops to Free.'}
          </Text>
        </EmailCard>

        <Section style={{ textAlign: 'center' as const, margin: '32px 0 8px' }}>
          <EmailButton href={manageBillingUrl}>Manage billing</EmailButton>
        </Section>

        <Text style={{ color: '#6b6b7b', fontSize: '12px', margin: '20px 0 0', textAlign: 'center' as const }}>
          Want to cancel? You can end your subscription before {trialEndDate} from the same page with no charge.
        </Text>
      </Section>
    </EmailLayout>
  );
}
```

- [ ] **Step 2: Verify it renders**

Run `npm run email` from `CXD/`, navigate to `trial-ending-soon`, verify layout + both branches (with card and without).

- [ ] **Step 3: Commit**

```bash
git add emails/trial-ending-soon.tsx
git commit -m "feat(email): add trial-ending-soon template"
```

---

## Task 5: Template — `trial-converted`

**Files:**
- Create: `emails/trial-converted.tsx`

- [ ] **Step 1: Write the template**

```tsx
import { Section, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';
import { EmailButton } from './_components/email-button';
import { EmailCard } from './_components/email-card';

interface TrialConvertedProps {
  userName: string;
  amountCharged: string; // e.g. "$20.00"
  nextBillingDate: string; // e.g. "June 8, 2026"
  dashboardUrl: string;
  receiptUrl?: string;
}

export default function TrialConverted({
  userName,
  amountCharged,
  nextBillingDate,
  dashboardUrl,
  receiptUrl,
}: TrialConvertedProps) {
  return (
    <EmailLayout previewText="Welcome to Pro. Your first charge was successful.">
      <Section style={{ padding: '40px 40px 20px' }}>
        <Heading
          as="h1"
          style={{ color: '#ffffff', fontSize: '28px', fontWeight: 700, margin: '0 0 12px', lineHeight: 1.2 }}
        >
          Welcome to Pro
        </Heading>

        <Text style={{ color: '#c8c4dd', fontSize: '15px', margin: '0 0 24px', lineHeight: 1.6 }}>
          Hi {userName}, your trial converted and your first charge of{' '}
          <strong style={{ color: '#ffffff' }}>{amountCharged}</strong> went through. You now have
          the full Pro experience, and your 500 AI credits for this month are already in your balance.
        </Text>

        <EmailCard>
          <Text style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>
            Next billing date
          </Text>
          <Text style={{ color: '#9a94b8', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
            {nextBillingDate}. You can manage your subscription from your dashboard at any time.
          </Text>
        </EmailCard>

        <Section style={{ textAlign: 'center' as const, margin: '32px 0 8px' }}>
          <EmailButton href={dashboardUrl}>Open your dashboard</EmailButton>
        </Section>

        {receiptUrl && (
          <Text style={{ color: '#6b6b7b', fontSize: '12px', margin: '20px 0 0', textAlign: 'center' as const }}>
            Need a receipt?{' '}
            <a href={receiptUrl} style={{ color: '#8b5cf6' }}>
              View on Stripe
            </a>
          </Text>
        )}
      </Section>
    </EmailLayout>
  );
}
```

- [ ] **Step 2: Verify it renders**

`npm run email`, navigate to `trial-converted`, check layout + optional receipt link.

- [ ] **Step 3: Commit**

```bash
git add emails/trial-converted.tsx
git commit -m "feat(email): add trial-converted template"
```

---

## Task 6: Template — `payment-failed`

**Files:**
- Create: `emails/payment-failed.tsx`

- [ ] **Step 1: Write the template**

```tsx
import { Section, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';
import { EmailButton } from './_components/email-button';
import { EmailCard } from './_components/email-card';

interface PaymentFailedProps {
  userName: string;
  amountDue: string; // e.g. "$20.00"
  cardBrand?: string;
  cardLast4?: string;
  nextRetryDate?: string; // e.g. "April 26, 2026"
  updatePaymentUrl: string;
}

export default function PaymentFailed({
  userName,
  amountDue,
  cardBrand,
  cardLast4,
  nextRetryDate,
  updatePaymentUrl,
}: PaymentFailedProps) {
  return (
    <EmailLayout previewText="We could not charge your card. Please update your payment method.">
      <Section style={{ padding: '40px 40px 20px' }}>
        <Heading
          as="h1"
          style={{ color: '#ffffff', fontSize: '26px', fontWeight: 700, margin: '0 0 12px', lineHeight: 1.2 }}
        >
          We could not charge your card
        </Heading>

        <Text style={{ color: '#c8c4dd', fontSize: '15px', margin: '0 0 24px', lineHeight: 1.6 }}>
          Hi {userName}, we tried to charge {amountDue} for your CXD Canvas Pro subscription and it
          did not go through. Cards expire, banks decline, and these things happen. Updating your
          payment method takes less than a minute.
        </Text>

        <EmailCard>
          <Text style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>
            Card on file
          </Text>
          <Text style={{ color: '#9a94b8', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
            {cardBrand && cardLast4
              ? `${cardBrand.toUpperCase()} ending in ${cardLast4}.`
              : 'No card details available.'}
            {nextRetryDate && ` We will retry automatically on ${nextRetryDate}.`}
          </Text>
        </EmailCard>

        <Section style={{ textAlign: 'center' as const, margin: '32px 0 8px' }}>
          <EmailButton href={updatePaymentUrl}>Update payment method</EmailButton>
        </Section>

        <Text style={{ color: '#6b6b7b', fontSize: '12px', margin: '20px 0 0', textAlign: 'center' as const }}>
          Your Pro access is still active while we sort this out. No immediate action required if the retry succeeds.
        </Text>
      </Section>
    </EmailLayout>
  );
}
```

- [ ] **Step 2: Verify it renders**

`npm run email`, navigate to `payment-failed`.

- [ ] **Step 3: Commit**

```bash
git add emails/payment-failed.tsx
git commit -m "feat(email): add payment-failed dunning template"
```

---

## Task 7: Template — `payment-final-warning`

**Files:**
- Create: `emails/payment-final-warning.tsx`

- [ ] **Step 1: Write the template**

```tsx
import { Section, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './_components/email-layout';
import { EmailButton } from './_components/email-button';
import { EmailCard } from './_components/email-card';

interface PaymentFinalWarningProps {
  userName: string;
  amountDue: string; // e.g. "$20.00"
  accessEndsDate: string; // e.g. "April 30, 2026"
  updatePaymentUrl: string;
}

export default function PaymentFinalWarning({
  userName,
  amountDue,
  accessEndsDate,
  updatePaymentUrl,
}: PaymentFinalWarningProps) {
  return (
    <EmailLayout previewText={`Last chance to restore your Pro access before ${accessEndsDate}.`}>
      <Section style={{ padding: '40px 40px 20px' }}>
        <Heading
          as="h1"
          style={{ color: '#ffffff', fontSize: '26px', fontWeight: 700, margin: '0 0 12px', lineHeight: 1.2 }}
        >
          Last chance to restore your Pro access
        </Heading>

        <Text style={{ color: '#c8c4dd', fontSize: '15px', margin: '0 0 24px', lineHeight: 1.6 }}>
          Hi {userName}, we have tried to charge {amountDue} several times over the past five days
          and every attempt has declined. If we cannot process the payment by{' '}
          <strong style={{ color: '#ffffff' }}>{accessEndsDate}</strong>, your account will drop to
          the Free tier.
        </Text>

        <EmailCard style={{ borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)' }}>
          <Text style={{ color: '#fda4af', fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>
            What happens if you do nothing
          </Text>
          <Text style={{ color: '#fecdd3', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
            You keep all your canvases, but lose unlimited projects, premium AI models, and team
            collaboration. Your work stays safe.
          </Text>
        </EmailCard>

        <Section style={{ textAlign: 'center' as const, margin: '32px 0 8px' }}>
          <EmailButton href={updatePaymentUrl}>Update payment method</EmailButton>
        </Section>

        <Text style={{ color: '#6b6b7b', fontSize: '12px', margin: '20px 0 0', textAlign: 'center' as const }}>
          Questions? Just reply to this email and we will help.
        </Text>
      </Section>
    </EmailLayout>
  );
}
```

Note: `EmailCard` may not accept a `style` prop. If type-check fails on the override, inline the styled card as a plain `<Section>` block instead (use the same shape as EmailCard but with the red accent). Review the `emails/_components/email-card.tsx` file to confirm.

- [ ] **Step 2: Verify the card accepts style overrides or inline the red card**

Read `emails/_components/email-card.tsx`. If the component doesn't spread extra props onto its root, replace the red `EmailCard` in the template with:

```tsx
<Section
  style={{
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: '12px',
    padding: '16px',
    margin: '0 0 16px',
  }}
>
  <Text style={{ color: '#fda4af', fontSize: '14px', fontWeight: 600, margin: '0 0 8px' }}>
    What happens if you do nothing
  </Text>
  <Text style={{ color: '#fecdd3', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
    You keep all your canvases, but lose unlimited projects, premium AI models, and team
    collaboration. Your work stays safe.
  </Text>
</Section>
```

- [ ] **Step 3: Verify it renders**

`npm run email`, navigate to `payment-final-warning`, confirm the red accent card.

- [ ] **Step 4: Commit**

```bash
git add emails/payment-final-warning.tsx
git commit -m "feat(email): add payment-final-warning dunning template"
```

---

## Task 8: Webhook — `customer.subscription.updated` handler (status sync fix)

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

This is the trial→paid auto-flip fix. No email. Keeps Supabase in sync with Stripe.

- [ ] **Step 1: Read the current webhook to find the insertion point**

Open `src/app/api/webhooks/stripe/route.ts`. Locate the existing `switch (event.type)` block and find the case `customer.subscription.deleted` — the new case goes immediately before it.

- [ ] **Step 2: Add the case**

Insert directly above the `case 'customer.subscription.deleted':` line:

```ts
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const { data: row, error: lookupErr } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (lookupErr || !row) {
          console.warn('[webhook] subscription.updated: no subscription row found for', customerId);
          break;
        }

        const { error: syncErr } = await supabase
          .from('subscriptions')
          .update({
            stripe_subscription_id: sub.id,
            status: sub.status,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            trial_start: sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
            trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
            cancel_at_period_end: sub.cancel_at_period_end,
            canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
            // plan_id only flips away from 'pro' on subscription.deleted; don't
            // clobber it here.
          })
          .eq('user_id', row.user_id);

        if (syncErr) {
          console.error('[webhook] Failed to sync subscription:', syncErr);
        }
        break;
      }
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors. If `cancel_at_period_end` or `canceled_at` columns don't exist on `subscriptions`, remove those lines. Check the existing columns in `src/app/api/webhooks/stripe/route.ts` in other cases for reference.

- [ ] **Step 4: Local smoke test with Stripe CLI**

In one terminal (from `CXD/`):

```bash
npm run dev
```

In a second terminal:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

(Copy the webhook signing secret it prints; if your local dev uses a different `STRIPE_WEBHOOK_SECRET`, export it for this session.)

In a third terminal:

```bash
stripe trigger customer.subscription.updated
```

Expected: dev server logs show the webhook received, no "Failed to sync subscription" errors. Optionally query Supabase to confirm the relevant row updated.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "fix(webhook): handle customer.subscription.updated so trial->paid flips in Supabase"
```

---

## Task 9: Webhook — `customer.subscription.trial_will_end` handler

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

Stripe fires this ~3 days before the trial ends.

- [ ] **Step 1: Add the import for the template + sendKindOnce**

At the top of `src/app/api/webhooks/stripe/route.ts` (alongside existing imports of `SubscriptionConfirmed`, etc.), add:

```ts
import TrialEndingSoon from '../../../../../emails/trial-ending-soon';
import { EMAIL_KINDS, sendKindOnce } from '@/lib/email-kinds';
```

- [ ] **Step 2: Add the case**

Immediately before `case 'customer.subscription.updated':` (the one from Task 8), add:

```ts
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const { data: row } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!row) break;

        const userInfo = await getUserInfo(row.user_id);
        if (!userInfo?.email) break;

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design';
        const trialEndDate = sub.trial_end
          ? new Date(sub.trial_end * 1000).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : 'soon';

        // Best-effort card info from the default payment method.
        let cardBrand: string | undefined;
        let cardLast4: string | undefined;
        try {
          const pmId =
            (sub.default_payment_method as string | null) ??
            (typeof sub.default_payment_method === 'object'
              ? (sub.default_payment_method as Stripe.PaymentMethod)?.id
              : undefined);
          if (pmId) {
            const pm = await stripe.paymentMethods.retrieve(pmId);
            cardBrand = pm.card?.brand ?? undefined;
            cardLast4 = pm.card?.last4 ?? undefined;
          }
        } catch (err) {
          console.warn('[webhook] Could not retrieve payment method for trial_will_end:', err);
        }

        await sendKindOnce({
          userId: row.user_id,
          userEmail: userInfo.email,
          kind: EMAIL_KINDS.TRIAL_ENDING_SOON,
          subject: `Your CXD Canvas Pro trial ends on ${trialEndDate}`,
          template: TrialEndingSoon({
            userName: userInfo.name || 'there',
            trialEndDate,
            cardBrand,
            cardLast4,
            manageBillingUrl: `${baseUrl}/dashboard/profile`,
          }),
          stripeEventId: event.id,
        });
        break;
      }
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Local smoke test**

With the dev server + `stripe listen` running:

```bash
stripe trigger customer.subscription.trial_will_end
```

Expected: dev server logs `[email] Sent trial-ending-soon to user=...`. Check Resend dashboard for the test send.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "feat(email): send trial-ending-soon on trial_will_end webhook"
```

---

## Task 10: Webhook — `invoice.paid` handler (trial-converted)

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Add the import**

At the top, add:

```ts
import TrialConverted from '../../../../../emails/trial-converted';
```

- [ ] **Step 2: Add the case**

Immediately before `case 'customer.subscription.trial_will_end':`, add:

```ts
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;

        // Only act on subscription cycle invoices — ignore one-off invoices.
        if (invoice.billing_reason !== 'subscription_cycle' && invoice.billing_reason !== 'subscription_create') {
          break;
        }

        const subscriptionId = invoice.subscription as string | null;
        if (!subscriptionId) break;

        const { data: row } = await supabase
          .from('subscriptions')
          .select('user_id, status')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (!row) break;

        // Only send trial-converted for the FIRST paid invoice after trial.
        // We detect this by checking Supabase's status — if it's still
        // 'trialing' at the moment this webhook fires, this is the post-trial
        // charge and we send the email. On subsequent monthly renewals the
        // status will already be 'active' and we skip.
        if (row.status !== 'trialing') break;

        const userInfo = await getUserInfo(row.user_id);
        if (!userInfo?.email) break;

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design';
        const nextBillingDate = invoice.period_end
          ? new Date(invoice.period_end * 1000).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : 'next month';

        await sendKindOnce({
          userId: row.user_id,
          userEmail: userInfo.email,
          kind: EMAIL_KINDS.TRIAL_CONVERTED,
          subject: 'Welcome to CXD Canvas Pro',
          template: TrialConverted({
            userName: userInfo.name || 'there',
            amountCharged: `$${(invoice.amount_paid / 100).toFixed(2)}`,
            nextBillingDate,
            dashboardUrl: `${baseUrl}/dashboard`,
            receiptUrl: invoice.hosted_invoice_url || undefined,
          }),
          stripeEventId: event.id,
        });
        break;
      }
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Local smoke test**

The easiest way to test this is with a full subscription flow in Stripe test mode (trigger a subscription, wait for the trial to auto-end via test clock OR use `stripe trigger invoice.paid` for a direct test). At minimum:

```bash
stripe trigger invoice.paid
```

Expected: dev server processes the event without error. If no matching subscription row in Supabase, the handler breaks early (that's fine).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "feat(email): send trial-converted on first invoice.paid after trial"
```

---

## Task 11: Webhook — `invoice.payment_failed` handler

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Add the import**

```ts
import PaymentFailed from '../../../../../emails/payment-failed';
```

- [ ] **Step 2: Add the case**

Immediately before `case 'invoice.paid':` (the one from Task 10), add:

```ts
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string | null;
        if (!subscriptionId) break;

        const { data: row } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (!row) break;

        // Mark as past_due so our cron scan can find the user at day 5.
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('user_id', row.user_id);

        const userInfo = await getUserInfo(row.user_id);
        if (!userInfo?.email) break;

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design';

        // Best-effort card + retry info.
        let cardBrand: string | undefined;
        let cardLast4: string | undefined;
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ['default_payment_method'],
          });
          const pm = sub.default_payment_method as Stripe.PaymentMethod | null;
          if (pm && pm.card) {
            cardBrand = pm.card.brand;
            cardLast4 = pm.card.last4;
          }
        } catch (err) {
          console.warn('[webhook] Could not fetch card for payment_failed:', err);
        }

        const nextRetryDate = invoice.next_payment_attempt
          ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : undefined;

        await sendKindOnce({
          userId: row.user_id,
          userEmail: userInfo.email,
          kind: EMAIL_KINDS.PAYMENT_FAILED,
          subject: 'We could not charge your card',
          template: PaymentFailed({
            userName: userInfo.name || 'there',
            amountDue: `$${(invoice.amount_due / 100).toFixed(2)}`,
            cardBrand,
            cardLast4,
            nextRetryDate,
            updatePaymentUrl: `${baseUrl}/dashboard/profile`,
          }),
          stripeEventId: event.id,
        });
        break;
      }
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Local smoke test**

```bash
stripe trigger invoice.payment_failed
```

Expected: webhook processes, Supabase row's `status` flips to `past_due`, `payment-failed` email logged via `sendKindOnce`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "feat(email): send payment-failed + flag past_due on payment failure webhook"
```

---

## Task 12: Cron route — scaffold + auth check

**Files:**
- Create: `src/app/api/cron/email-scheduler/route.ts`

Start with auth + an empty success response. Subsequent tasks add the two scan functions.

- [ ] **Step 1: Create the route file**

```ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET) {
    console.error('[cron] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (authHeader !== expected) {
    return unauthorized();
  }

  const startedAt = Date.now();
  const results: Record<string, number> = {};

  // Scans get added in follow-up tasks:
  //   results.trialDay1 = await runTrialDay1Scan();
  //   results.paymentFinalWarning = await runPaymentFinalWarningScan();

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    results,
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Set `CRON_SECRET` locally in `.env.local`**

Generate a secret:

```bash
openssl rand -hex 32
```

Copy the output. Open `.env.local` in the editor, add:

```
CRON_SECRET=<paste the hex string>
```

Restart the dev server so it picks up the new env var.

- [ ] **Step 4: Verify auth**

With dev server running:

```bash
# Expect 401
curl -i http://localhost:3000/api/cron/email-scheduler

# Expect 200 + {"ok":true,...}
curl -i -H "Authorization: Bearer <your CRON_SECRET>" http://localhost:3000/api/cron/email-scheduler
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/email-scheduler/route.ts
git commit -m "feat(cron): scaffold email-scheduler route with CRON_SECRET bearer auth"
```

---

## Task 13: Cron scan — trial day 1

**Files:**
- Modify: `src/app/api/cron/email-scheduler/route.ts`

- [ ] **Step 1: Add the scan function and wire it in**

Replace the entire contents of `src/app/api/cron/email-scheduler/route.ts` with:

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import TrialDay1 from '../../../../../emails/trial-day-1';
import { EMAIL_KINDS, sendKindOnce } from '@/lib/email-kinds';

export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

async function runTrialDay1Scan(): Promise<{ sent: number; skipped: number }> {
  const supabase = adminClient();
  const now = Date.now();

  // Window: 24–48 hours after trial_start. Generous so a missed cron run
  // catches up the next day without skipping users.
  const upper = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const lower = new Date(now - 48 * 60 * 60 * 1000).toISOString();

  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('user_id, trial_end, users:users!inner(email, full_name)')
    .eq('status', 'trialing')
    .gte('trial_start', lower)
    .lte('trial_start', upper);

  if (error) {
    console.error('[cron] trial-day-1 scan failed:', error);
    return { sent: 0, skipped: 0 };
  }

  const rows = (subs ?? []) as Array<{
    user_id: string;
    trial_end: string | null;
    users: { email: string; full_name: string | null } | { email: string; full_name: string | null }[];
  }>;
  let sent = 0;
  let skipped = 0;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design';

  for (const row of rows) {
    const userObj = Array.isArray(row.users) ? row.users[0] : row.users;
    if (!userObj?.email) continue;

    const trialEndDate = row.trial_end
      ? new Date(row.trial_end).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'soon';

    const wasSent = await sendKindOnce({
      userId: row.user_id,
      userEmail: userObj.email,
      kind: EMAIL_KINDS.TRIAL_DAY_1,
      subject: "Your Pro trial is live — let's get started",
      template: TrialDay1({
        userName: userObj.full_name || 'there',
        trialEndDate,
        dashboardUrl: `${baseUrl}/dashboard`,
      }),
    });

    if (wasSent) sent++;
    else skipped++;
  }

  return { sent, skipped };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET) {
    console.error('[cron] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (authHeader !== expected) {
    return unauthorized();
  }

  const startedAt = Date.now();
  const results: Record<string, { sent: number; skipped: number }> = {};

  results.trialDay1 = await runTrialDay1Scan();

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    results,
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Test with seed data**

Manually seed a test row in Supabase (via SQL editor on dashboard) matching the 24–48h window:

```sql
-- Adjust user_id to a real test user in your DB
update public.subscriptions
set status = 'trialing',
    trial_start = now() - interval '30 hours',
    trial_end = now() + interval '14 days'
where user_id = '<test-user-uuid>';
```

Then hit the cron endpoint:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/email-scheduler
```

Expected response: `{"ok":true,"results":{"trialDay1":{"sent":1,"skipped":0}}}`. Resend logs show the send. Re-run the curl: expect `{"sent":0,"skipped":1}` (idempotency works).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/email-scheduler/route.ts
git commit -m "feat(cron): add trial-day-1 scan to email-scheduler"
```

---

## Task 14: Cron scan — payment final warning (day 5)

**Files:**
- Modify: `src/app/api/cron/email-scheduler/route.ts`

- [ ] **Step 1: Add the import for the template**

At the top of the file, alongside the `TrialDay1` import, add:

```ts
import PaymentFinalWarning from '../../../../../emails/payment-final-warning';
```

- [ ] **Step 2: Add the scan function**

Add this function directly below `runTrialDay1Scan`:

```ts
async function runPaymentFinalWarningScan(): Promise<{ sent: number; skipped: number }> {
  const supabase = adminClient();
  const now = Date.now();

  // Window: 4.5–5.5 days after the payment-failed email was logged.
  const upper = new Date(now - 4.5 * 24 * 60 * 60 * 1000).toISOString();
  const lower = new Date(now - 5.5 * 24 * 60 * 60 * 1000).toISOString();

  // Find past_due users whose payment-failed email was logged in the window
  // AND who haven't already received a payment-final-warning.
  const { data: candidates, error } = await supabase
    .from('email_log')
    .select('user_id, sent_at')
    .eq('email_kind', 'payment-failed')
    .gte('sent_at', lower)
    .lte('sent_at', upper);

  if (error) {
    console.error('[cron] payment-final-warning candidate query failed:', error);
    return { sent: 0, skipped: 0 };
  }

  let sent = 0;
  let skipped = 0;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://canvas.cyberdelic.design';

  for (const candidate of candidates ?? []) {
    // Confirm still past_due + pull user + subscription info.
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('user_id, status, current_period_end, users:users!inner(email, full_name), stripe_subscription_id')
      .eq('user_id', candidate.user_id)
      .single();

    if (!sub || sub.status !== 'past_due') {
      skipped++;
      continue;
    }

    const userObj = Array.isArray(sub.users) ? sub.users[0] : sub.users;
    if (!userObj?.email) {
      skipped++;
      continue;
    }

    // Access ends ~2 days after the final warning (when Stripe's 4th retry
    // runs at day 7 and fails, subscription.deleted fires). We surface that
    // as "in 2 days" friendly copy.
    const accessEndsDate = new Date(now + 2 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Amount: fetch the open invoice for the most recent amount_due, or fall
    // back to "your subscription amount".
    let amountDue = '$20.00';
    try {
      if (sub.stripe_subscription_id) {
        // Lazy import of Stripe to avoid pulling it into the top-level module
        // graph more than necessary.
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' });
        const invoices = await stripe.invoices.list({
          subscription: sub.stripe_subscription_id,
          status: 'open',
          limit: 1,
        });
        const open = invoices.data[0];
        if (open) amountDue = `$${(open.amount_due / 100).toFixed(2)}`;
      }
    } catch (err) {
      console.warn('[cron] Could not retrieve open invoice amount:', err);
    }

    const wasSent = await sendKindOnce({
      userId: sub.user_id,
      userEmail: userObj.email,
      kind: EMAIL_KINDS.PAYMENT_FINAL_WARNING,
      subject: 'Last chance to restore your Pro access',
      template: PaymentFinalWarning({
        userName: userObj.full_name || 'there',
        amountDue,
        accessEndsDate,
        updatePaymentUrl: `${baseUrl}/dashboard/profile`,
      }),
    });

    if (wasSent) sent++;
    else skipped++;
  }

  return { sent, skipped };
}
```

- [ ] **Step 3: Wire it into the GET handler**

Find the existing line in the GET handler:

```ts
  results.trialDay1 = await runTrialDay1Scan();
```

Add directly below it:

```ts
  results.paymentFinalWarning = await runPaymentFinalWarningScan();
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Smoke test**

Seed test data:

```sql
-- Put a real test user into past_due + an existing payment-failed email_log 5 days old
update public.subscriptions
set status = 'past_due'
where user_id = '<test-user-uuid>';

insert into public.email_log (user_id, email_kind, sent_at)
values ('<test-user-uuid>', 'payment-failed', now() - interval '5 days');
```

Hit the cron:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/email-scheduler
```

Expected: `paymentFinalWarning: { sent: 1, skipped: 0 }` in the response, plus a send in Resend logs. Re-run: idempotency pushes it to `sent: 0, skipped: 1`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/email-scheduler/route.ts
git commit -m "feat(cron): add payment-final-warning scan at day 5 of past_due"
```

---

## Task 15: Vercel cron schedule + function config

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Read the current vercel.json**

```bash
cat vercel.json
```

Expected current content:

```json
{
  "functions": {
    "src/app/api/ai/**/*.ts": {
      "maxDuration": 60,
      "memory": 1024
    },
    "src/app/api/webhooks/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

- [ ] **Step 2: Replace with cron + function config**

Write the new `vercel.json`:

```json
{
  "functions": {
    "src/app/api/ai/**/*.ts": {
      "maxDuration": 60,
      "memory": 1024
    },
    "src/app/api/webhooks/**/*.ts": {
      "maxDuration": 30
    },
    "src/app/api/cron/**/*.ts": {
      "maxDuration": 60
    }
  },
  "crons": [
    {
      "path": "/api/cron/email-scheduler",
      "schedule": "0 14 * * *"
    }
  ]
}
```

Schedule is daily at 14:00 UTC (≈ 10am ET / 7am PT). Vercel's cron scheduler will hit the path with the `Authorization: Bearer $CRON_SECRET` header automatically when `CRON_SECRET` is configured in the project's env vars.

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat(cron): schedule email-scheduler daily at 14:00 UTC"
```

---

## Task 16: Production env var + Stripe dashboard configuration

This is a manual configuration task. No code changes.

- [ ] **Step 1: Add `CRON_SECRET` to Vercel**

Generate a production secret:

```bash
openssl rand -hex 32
```

In Vercel dashboard → Project Settings → Environment Variables:
1. Add new variable: Key `CRON_SECRET`, Value = the hex string, **Sensitive toggle ON**, Environments: Production + Preview (leave Development empty or reuse `.env.local` value).
2. Save.

- [ ] **Step 2: Flip the Stripe invoice-reminder toggle**

Log into Stripe dashboard (live mode) → Settings → Billing → Subscriptions and emails → scroll to **Manage invoices sent to customers**.

Toggle **"Send reminders if a recurring invoice hasn't been paid"** → OFF.

Leave **"Send finalized invoices and credit notes"** → ON (tax/legal).

Save.

- [ ] **Step 3: Confirm other Stripe toggles match the spec**

Spot-check:
- Settings → Billing → Subscriptions and emails → Customer emails: all 5 toggles OFF (trial reminder, upcoming renewals, expiring cards, card failed, bank debit failed).
- Manage failed payments: Smart Retry, 4 attempts over 1 week, cancel subscription on all failures.
- Business → Customer emails → Payments: Successful payments OFF, Refunds OFF.

No action required if these already match.

- [ ] **Step 4: Add `CRON_SECRET` to `.env.local` (if not already from Task 12)**

Ensure `.env.local` in the repo working directory has:

```
CRON_SECRET=<the dev hex string from Task 12>
```

(Use a different value than production.)

- [ ] **Step 5: Deploy + verify**

Push the branch and let Vercel deploy. After deploy:

```bash
curl -i -H "Authorization: Bearer <PROD_CRON_SECRET>" https://canvas.cyberdelic.design/api/cron/email-scheduler
```

Expected: `{"ok":true,...}`. No actual sends unless real users match the scan windows.

Check Vercel → Project → Deployments → the deploy → "Cron Jobs" tab, should list `/api/cron/email-scheduler` on schedule `0 14 * * *`.

- [ ] **Step 6: End-to-end live test (optional but recommended)**

In Stripe test mode:
1. Create a Pro subscription with a pre-declining test card (`4000000000000341`).
2. Wait for the trial to end (or use Stripe test clocks to jump forward).
3. Watch webhook logs for `invoice.payment_failed`. Verify `payment-failed` email sent via Resend.
4. On day 5 after that, run the cron endpoint manually and verify `payment-final-warning` sends.
5. Check Supabase `subscriptions.status` flips through `trialing → past_due` correctly.

No commit here — this task is configuration and verification.

---

## Self-review (completed)

- **Spec coverage:**
  - 5 templates → Tasks 3–7 ✓
  - 4 new webhook cases → Tasks 8, 9, 10, 11 ✓
  - subscription.updated status sync → Task 8 ✓ (addresses the trial→paid auto-flip fix explicitly)
  - Cron route + 2 scans → Tasks 12, 13, 14 ✓
  - Vercel.json cron entry → Task 15 ✓
  - email_log table → Task 1 ✓
  - CRON_SECRET env var + Stripe dashboard toggle → Task 16 ✓
  - Shared sendKindOnce helper → Task 2 ✓
- **Placeholder scan:** No "TBD", no "handle edge cases". Each step shows the concrete code or concrete command. Task 7's conditional (`EmailCard` style prop) provides a fallback path with actual replacement JSX, not a vague "if needed, fix".
- **Type consistency:** `EMAIL_KINDS` enum keys used consistently (Tasks 2, 9, 10, 11, 13, 14). `sendKindOnce` signature is defined once (Task 2) and every caller passes matching props. `subscriptions` column names match what the existing webhook in `src/app/api/webhooks/stripe/route.ts` uses.
- **Cross-task consistency:** Webhook tasks 8–11 all layer additive cases into the same switch statement in a specific insertion order (updated → trial_will_end → invoice.paid → payment_failed, all BEFORE `customer.subscription.deleted`). Cron scan order matches spec (trialDay1 first, paymentFinalWarning second).
