import type { ReactNode } from 'react';
import Link from 'next/link';
import { formatMoney, isAllClear, type AttentionCounts, type CurrencyTotals, type SourceResult } from '@/lib/admin/analytics/metrics';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="text-sm font-medium text-white/60">{title}</h2>
      {children}
    </section>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 [&>*]:min-w-0">{children}</div>;
}

export function Panel({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 min-w-0">{children}</div>;
}

export function Unavailable() {
  return <p className="text-sm text-white/40">Unavailable</p>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Panel>
      <p className="text-xs text-white/50">{label}</p>
      <div className="mt-1 text-xl sm:text-2xl font-semibold tabular-nums break-words">{value}</div>
      {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
    </Panel>
  );
}

export function Money({ totals }: { totals: CurrencyTotals }) {
  const currencies = Object.keys(totals);
  if (currencies.length === 0) return <>{formatMoney(0, 'usd')}</>;
  return (
    <>
      {currencies.map((currency) => (
        <div key={currency}>{formatMoney(totals[currency], currency)}</div>
      ))}
    </>
  );
}

function AttentionLink({ href, label, count }: { href: string; label: string; count: number }) {
  return (
    <Link href={href} className="rounded-lg border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06]">
      <p className="text-xs text-white/50">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${count > 0 ? 'text-amber-300' : ''}`}>{count}</p>
    </Link>
  );
}

export function AttentionStrip({ result, canSeeComms }: { result: SourceResult<AttentionCounts>; canSeeComms: boolean }) {
  if (!result.ok) return <Panel><Unavailable /></Panel>;
  if (isAllClear(result)) return <Panel><p className="text-sm text-emerald-400">All clear</p></Panel>;
  const { openTickets, highPriorityTickets, unresolvedErrors, failedPayments, failedEmails } = result.data;
  return (
    <Grid>
      <AttentionLink href="/admin/support" label={highPriorityTickets ? `Open cards (${highPriorityTickets} high)` : 'Open cards'} count={openTickets} />
      <AttentionLink href="/admin/errors" label="Unresolved errors" count={unresolvedErrors} />
      <AttentionLink href="/admin/users" label="Failed payments" count={failedPayments} />
      <AttentionLink href={canSeeComms ? '/admin/comms' : '/admin/support'} label="Failed emails" count={failedEmails} />
    </Grid>
  );
}
