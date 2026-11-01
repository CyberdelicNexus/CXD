import { NextResponse } from 'next/server';
import { getStaffContext } from '@/lib/admin/gate';

export const dynamic = 'force-dynamic';

export async function GET() {
  const staff = await getStaffContext();
  return NextResponse.json({ role: staff?.role ?? null });
}
