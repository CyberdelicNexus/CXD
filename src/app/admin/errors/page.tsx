import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePagePermission } from '@/lib/admin/gate';
import { formatDate } from '@/lib/admin/users';
import { isHttpUrl } from '@/lib/admin/tickets';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default async function AdminErrorsPage() {
  await requirePagePermission('errors.view');
  const { data, error } = await getSupabaseAdmin()
    .from('fix_pipeline')
    .select('id, title, level, status, triage_tier, event_count, user_count, permalink, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  // A failed query must not read as "nothing triaged": throw so the error boundary shows it.
  if (error) throw new Error(`fix_pipeline query failed: ${error.code ?? 'error'}: ${error.message}`);
  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Errors</h1>
        <p className="text-sm text-white/50">Sentry triage, read-only. Acknowledge and snooze in Telegram.</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Issue</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Events</TableHead>
            <TableHead>Users</TableHead>
            <TableHead>Seen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-96 truncate">
                {isHttpUrl(row.permalink) ? (
                  <a href={row.permalink} target="_blank" rel="noreferrer noopener" className="text-violet-200 hover:underline">{row.title}</a>
                ) : row.title}
              </TableCell>
              <TableCell>{row.level ?? '—'}</TableCell>
              <TableCell>{row.triage_tier ?? '—'}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell>{row.event_count ?? 0}</TableCell>
              <TableCell>{row.user_count ?? 0}</TableCell>
              <TableCell>{formatDate(row.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length === 0 && <p className="text-sm text-white/50">No triaged issues.</p>}
    </div>
  );
}
