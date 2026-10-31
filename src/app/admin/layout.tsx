import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import DashboardNavbar from '@/components/dashboard-navbar';
import { AdminNav } from '@/components/admin/admin-nav';
import { getStaffContext } from '@/lib/admin/gate';

export const metadata = { title: 'Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await getStaffContext();
  if (!staff) notFound();

  return (
    <div className="min-h-screen bg-black text-white">
      <DashboardNavbar />
      <div className="container mx-auto max-w-7xl px-4 py-6 grid md:grid-cols-[180px_1fr] gap-6">
        <AdminNav role={staff.role} />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
