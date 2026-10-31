import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePagePermission } from '@/lib/admin/gate';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default async function AdminAuditPage() {
  await requirePagePermission('audit.view');
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('admin_audit_log')
    .select('id, actor_id, action, target_type, target_id, reason, outcome, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  // A failed query must not read as "nothing recorded": throw so the error boundary shows it.
  if (error) throw new Error(`audit log query failed: ${error.code ?? 'error'}: ${error.message}`);
  const rows = data ?? [];

  const actorIds = Array.from(new Set(rows.map((row) => row.actor_id as string)));
  const actors = actorIds.length ? await admin.from('users').select('id, email').in('id', actorIds) : { data: [], error: null };
  if (actors.error) throw new Error(`audit actor lookup failed: ${actors.error.code ?? 'error'}: ${actors.error.message}`);
  const actorEmail = new Map((actors.data ?? []).map((actor) => [actor.id as string, actor.email as string]));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit log</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Who</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap">{(row.created_at as string).slice(0, 16).replace('T', ' ')}</TableCell>
              <TableCell>{actorEmail.get(row.actor_id as string) ?? row.actor_id}</TableCell>
              <TableCell>{row.action}</TableCell>
              <TableCell>{row.target_type} {row.target_id ? (row.target_id as string).slice(0, 8) : ''}</TableCell>
              <TableCell>{row.outcome}</TableCell>
              <TableCell>{row.reason ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length === 0 && <p className="text-sm text-white/50">Nothing recorded yet.</p>}
    </div>
  );
}
