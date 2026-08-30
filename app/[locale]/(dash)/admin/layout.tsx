export const dynamic = 'force-dynamic';

import { redirect } from '@/i18n/navigation';
import { AuthError, requireStaff } from '@/lib/auth';
import { loadIdentityForShell } from '@/lib/session';
import { countNewLeads } from '@/lib/leads';
import { countPendingRegistrations } from '@/lib/queries';
import DashboardShell from '@/components/layout/DashboardShell';

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [staff, newLeads, pendingRegistrations] = await awaitStaffGuarded();
  if (!staff) redirect({ href: '/login', locale });
  const identity = await loadIdentityForShell(staff.authUserId);
  return (
    <DashboardShell zone="admin" identity={identity} newLeads={newLeads} pendingRegistrations={pendingRegistrations}>
      {children}
    </DashboardShell>
  );
}

/** requireStaff, but AuthErrors resolve to null (→ redirect) instead of throwing. */
async function awaitStaffGuarded(): Promise<[Awaited<ReturnType<typeof requireStaff>>, number, number]> {
  try {
    const staff = await requireStaff();
    const [newLeads, pendingRegistrations] = await Promise.all([countNewLeads(), countPendingRegistrations()]);
    return [staff, newLeads, pendingRegistrations];
  } catch (error) {
    if (error instanceof AuthError) return [null as unknown as Awaited<ReturnType<typeof requireStaff>>, 0, 0];
    throw error;
  }
}
