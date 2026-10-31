import { getSupabaseAdmin } from '@/supabase/admin';
import { requirePagePermission } from '@/lib/admin/gate';
import { formatDate } from '@/lib/admin/users';
import { Composer } from '@/components/admin/composer';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default async function AdminCommsPage() {
  await requirePagePermission('comms.send');
  const { data, error } = await getSupabaseAdmin()
    .from('broadcasts')
    .select('id, subject, channels, category, recipient_count, sent_count, failed_count, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  // A failed query must not read as "Nothing sent yet": throw so the error boundary shows it.
  if (error) throw new Error(`broadcast history query failed: ${error.code ?? 'error'}: ${error.message}`);
  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Comms</h1>
      <Composer />
      <section className="space-y-2">
        <h2 className="font-medium">History</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sent</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Emails delivered</TableHead>
              <TableHead>Failed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatDate(row.created_at)}</TableCell>
                <TableCell>{row.subject}</TableCell>
                <TableCell>{(row.channels as string[]).join(', ')}</TableCell>
                <TableCell>{row.recipient_count}</TableCell>
                <TableCell>{row.sent_count}</TableCell>
                <TableCell>{row.failed_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length === 0 && <p className="text-sm text-white/50">Nothing sent yet.</p>}
      </section>
    </div>
  );
}
