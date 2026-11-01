'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Home, LifeBuoy, Megaphone, ScrollText, Users, type LucideIcon } from 'lucide-react';
import { can, type Permission, type StaffRole } from '@/lib/admin/permissions';

const ITEMS: { href: string; label: string; icon: LucideIcon; permission: Permission }[] = [
  { href: '/admin', label: 'Home', icon: Home, permission: 'tickets.work' },
  { href: '/admin/support', label: 'Support', icon: LifeBuoy, permission: 'tickets.work' },
  { href: '/admin/users', label: 'Users', icon: Users, permission: 'users.view' },
  { href: '/admin/errors', label: 'Errors', icon: Activity, permission: 'errors.view' },
  { href: '/admin/comms', label: 'Comms', icon: Megaphone, permission: 'comms.send' },
  { href: '/admin/audit', label: 'Audit log', icon: ScrollText, permission: 'audit.view' },
];

export function AdminNav({ role }: { role: StaffRole }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex md:flex-col gap-1 overflow-x-auto">
      {ITEMS.filter((item) => can(role, item.permission)).map(({ href, label, icon: Icon }) => {
        const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors ${
              active ? 'bg-violet-500/20 text-violet-100' : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
