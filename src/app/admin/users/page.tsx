import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requirePagePermission } from '@/lib/admin/gate';
import { USERS_PAGE_SIZE, formatDate, listUsers } from '@/lib/admin/users';
import { parsePage, singleParam } from '@/lib/admin/users-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const FIELD = 'h-9 rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string | string[]; plan?: string | string[]; role?: string | string[]; page?: string | string[] };
}) {
  await requirePagePermission('users.view');
  const q = singleParam(searchParams.q);
  const plan = singleParam(searchParams.plan);
  const role = singleParam(searchParams.role);
  const page = parsePage(searchParams.page);
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (plan) params.set('plan', plan);
    if (role) params.set('role', role);
    params.set('page', String(target));
    return `/admin/users?${params}`;
  };

  const { rows, total } = await listUsers({ search: q, plan, role, page });
  // A page past the end has no rows and so no total: go back to the first page.
  if (rows.length === 0 && page > 1) redirect(pageHref(1));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Users</h1>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Name or email" aria-label="Search" className={`${FIELD} flex-1 min-w-48`} />
        <select name="plan" defaultValue={plan ?? ''} aria-label="Plan" className={FIELD}>
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="lifetime">Lifetime</option>
          <option value="beta_tester">Beta tester</option>
        </select>
        <select name="role" defaultValue={role ?? ''} aria-label="Role" className={FIELD}>
          <option value="">All roles</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
        </select>
        <button type="submit" className={`${FIELD} hover:bg-white/10`}>Filter</button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Credits used</TableHead>
            <TableHead>Last sign-in</TableHead>
            <TableHead>Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <Link href={`/admin/users/${user.id}`} className="text-violet-200 hover:underline">
                  {user.name || user.email}
                </Link>
                <div className="text-xs text-white/40">{user.email}</div>
              </TableCell>
              <TableCell>{user.plan_id}</TableCell>
              <TableCell>{user.used_this_period ?? 0} / {user.monthly_allowance ?? 0}</TableCell>
              <TableCell>{formatDate(user.last_sign_in_at)}</TableCell>
              <TableCell>{user.role ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {rows.length === 0 && <p className="text-sm text-white/50">No users match these filters.</p>}

      <div className="flex items-center justify-between text-sm text-white/50">
        <span>{total} users</span>
        <div className="flex gap-3">
          {page > 1 && <Link href={pageHref(page - 1)} className="hover:text-white">Previous</Link>}
          {page * USERS_PAGE_SIZE < total && <Link href={pageHref(page + 1)} className="hover:text-white">Next</Link>}
        </div>
      </div>
    </div>
  );
}
