import { redirect } from 'next/navigation';
import { requirePagePermission } from '@/lib/admin/gate';

export default async function AdminHome() {
  await requirePagePermission('tickets.work');
  redirect('/admin/support');
}
