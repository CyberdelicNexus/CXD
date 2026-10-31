import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePagePermission } from '@/lib/admin/gate';
import { can, isBanned } from '@/lib/admin/permissions';
import { isUuid } from '@/lib/admin/http';
import { planEditBlock } from '@/lib/admin/plan-guard';
import { formatDate, getUserDetail } from '@/lib/admin/users';
import { listTicketsForUser } from '@/lib/admin/support';
import { UserActions } from '@/components/admin/user-actions';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-white/5">
      <dt className="text-white/50">{label}</dt>
      <dd className="text-right break-all">{children}</dd>
    </div>
  );
}

export default async function AdminUserPage({ params }: { params: { id: string } }) {
  const staff = await requirePagePermission('users.view');
  if (!isUuid(params.id)) notFound();
  const canSeeAudit = can(staff.role, 'audit.view');
  const user = await getUserDetail(params.id, { includeAudit: canSeeAudit });
  if (!user) notFound();
  const tickets = await listTicketsForUser(user.id);
  const suspended = isBanned(user.bannedUntil, new Date());

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/users" className="text-sm text-white/50 hover:text-white">Users</Link>
        <h1 className="text-xl font-semibold">{user.name || user.email}</h1>
        {suspended && <p className="text-sm text-rose-400">Suspended</p>}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <dl className="rounded-lg border border-white/10 p-4">
          <Row label="Email">{user.email}</Row>
          <Row label="Role">{user.role ?? '—'}</Row>
          <Row label="Joined">{formatDate(user.createdAt)}</Row>
          <Row label="Last sign-in">{formatDate(user.lastSignInAt)}</Row>
          <Row label="Canvases">{user.canvasCount}</Row>
          <Row label="Plan">{user.subscription?.plan_id ?? 'free'}</Row>
          <Row label="Plan status">{user.subscription?.status ?? '—'}</Row>
          <Row label="Plan source">{user.subscription?.plan_source ?? '—'}</Row>
          <Row label="Credits used">{user.credits?.used_this_period ?? 0} / {user.credits?.monthly_allowance ?? 0}</Row>
          <Row label="Add-on credits">{user.credits?.addon_credits ?? 0}</Row>
          <Row label="Nexus member">{user.nexusMemberId ?? '—'}</Row>
          <Row label="Stripe subscription">
            {user.subscription?.stripe_subscription_id ? (
              <a
                href={`https://dashboard.stripe.com/subscriptions/${user.subscription.stripe_subscription_id}`}
                target="_blank"
                rel="noreferrer"
                className="text-violet-200 hover:underline"
              >
                {user.subscription.stripe_subscription_id}
              </a>
            ) : '—'}
          </Row>
          <Row label="Stripe">
            {user.subscription?.stripe_customer_id ? (
              <a
                href={`https://dashboard.stripe.com/customers/${user.subscription.stripe_customer_id}`}
                target="_blank"
                rel="noreferrer"
                className="text-violet-200 hover:underline"
              >
                Open customer
              </a>
            ) : '—'}
          </Row>
        </dl>

        <UserActions
          actor={{
            id: staff.userId,
            role: staff.role,
            canEdit: can(staff.role, 'users.edit'),
            canAssign: can(staff.role, 'roles.assign'),
          }}
          target={{
            id: user.id,
            role: user.role,
            plan: user.subscription?.plan_id ?? 'free',
            planBlock: user.subscription ? planEditBlock(user.subscription) : null,
            suspended,
          }}
        />
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">Support cards</h2>
        {tickets.length === 0 && <p className="text-sm text-white/50">None yet.</p>}
        {tickets.map((ticket) => (
          <Link key={ticket.id} href={`/admin/support/${ticket.id}`} className="block text-sm text-violet-200 hover:underline">
            {ticket.title} ({ticket.status})
          </Link>
        ))}
      </section>

      {canSeeAudit && (
        <section className="space-y-2">
          <h2 className="font-medium">Admin history</h2>
          {user.audit.length === 0 && <p className="text-sm text-white/50">None yet.</p>}
          {user.audit.map((entry) => (
            <p key={entry.id} className="text-sm text-white/70">
              {formatDate(entry.created_at)} · {entry.action} · {entry.outcome}{entry.reason ? ` · ${entry.reason}` : ''}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
