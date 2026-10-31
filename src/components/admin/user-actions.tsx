'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { adminPost } from '@/lib/admin/client';
import { ADMIN_PLANS, type PlanBlock } from '@/lib/admin/plan-guard';
import { canSuspend, SUSPEND_REFUSED, type StaffRole } from '@/lib/admin/permissions';

const FIELD = 'h-9 w-full rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white';

const PLAN_BLOCK_TEXT: Record<PlanBlock, string> = {
  stripe_managed: 'Managed by Stripe. Change it in the Stripe dashboard, or the user keeps being charged and the next webhook overwrites this.',
  nexus_managed: 'Managed by Cyberdelic Nexus. The tier sync would overwrite a change made here.',
  lifetime_plan: 'Lifetime plans cannot be changed here.',
};

interface Props {
  actor: { id: string; role: StaffRole; canEdit: boolean; canAssign: boolean };
  target: { id: string; role: StaffRole | null; plan: string; planBlock: PlanBlock | null; suspended: boolean };
}

export function UserActions({ actor, target }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [plan, setPlan] = useState(target.plan);
  const [amount, setAmount] = useState('');
  const [role, setRole] = useState<string>(target.role ?? '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(url: string, body: unknown, done: string): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    try {
      await adminPost(url, body);
      setMessage({ ok: true, text: done });
      setReason('');
      router.refresh();
      return true;
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const base = `/api/admin/users/${target.id}`;
  const hasReason = reason.trim().length >= 3;
  const suspendBlock = canSuspend({ actorId: actor.id, actorRole: actor.role, targetId: target.id, targetRole: target.role });

  if (!actor.canEdit && !actor.canAssign) return null;

  return (
    <section className="space-y-4 rounded-lg border border-white/10 p-4">
      <h2 className="font-medium">Actions</h2>
      <div className="space-y-1">
        <label htmlFor="reason" className="text-sm text-white/60">Reason (required, saved to the audit log)</label>
        <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className={FIELD} />
      </div>

      {actor.canEdit && (
        <>
          <div className="space-y-1">
            <label htmlFor="plan" className="text-sm text-white/60">Plan</label>
            {target.planBlock ? (
              <p className="text-sm text-white/50">{PLAN_BLOCK_TEXT[target.planBlock]}</p>
            ) : (
              <div className="flex gap-2">
                <select id="plan" value={plan} onChange={(e) => setPlan(e.target.value)} className={FIELD}>
                  {ADMIN_PLANS.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <Button
                  size="sm"
                  disabled={busy || !hasReason || plan === target.plan}
                  onClick={() => run(`${base}/plan`, { plan, reason }, 'Plan changed.')}
                >
                  Change
                </Button>
              </div>
            )}
            {!target.planBlock && <p className="text-xs text-white/40">Changing plan resets the monthly credit allowance to the new plan's amount.</p>}
          </div>

          <div className="space-y-1">
            <label htmlFor="credits" className="text-sm text-white/60">Add or remove credits (use a minus sign to remove)</label>
            <div className="flex gap-2">
              <input id="credits" type="number" step={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={FIELD} />
              <Button
                size="sm"
                disabled={busy || !hasReason || !Number(amount)}
                onClick={async () => {
                  if (await run(`${base}/credits`, { amount: Number(amount), reason }, 'Credits adjusted.')) setAmount('');
                }}
              >
                Apply
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(target.role === null || actor.role === 'owner') && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(`${base}/password-reset`, {}, 'Reset email sent.')}>
                Send password reset
              </Button>
            )}
            {!suspendBlock && (
              <Button
                size="sm"
                variant={target.suspended ? 'outline' : 'destructive'}
                disabled={busy || !hasReason}
                onClick={() => run(`${base}/suspend`, { suspended: !target.suspended, reason }, target.suspended ? 'Account restored.' : 'Account suspended.')}
              >
                {target.suspended ? 'Restore account' : 'Suspend account'}
              </Button>
            )}
          </div>
          {suspendBlock && <p className="text-xs text-white/40">{SUSPEND_REFUSED[suspendBlock]}</p>}
          {!target.suspended && !suspendBlock && <p className="text-xs text-white/40">Suspending keeps all data and does not cancel Stripe billing.</p>}
        </>
      )}

      {actor.canAssign && target.role !== 'owner' && (
        <div className="space-y-1">
          <label htmlFor="role" className="text-sm text-white/60">Role</label>
          <div className="flex gap-2">
            <select id="role" value={role} onChange={(e) => setRole(e.target.value)} className={FIELD}>
              <option value="">No role</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
            <Button
              size="sm"
              disabled={busy || !hasReason || role === (target.role ?? '')}
              onClick={() => run(`${base}/role`, { role: role || null, reason }, 'Role updated.')}
            >
              Save
            </Button>
          </div>
        </div>
      )}

      {message && (
        <p role="status" className={`text-sm ${message.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{message.text}</p>
      )}
    </section>
  );
}
