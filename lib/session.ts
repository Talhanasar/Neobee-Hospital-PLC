import { prisma } from '@/lib/db';
import { demoInvestorForAuthUser, demoStaffForAuthUser, isDemoData } from '@/data/demo/store';

export function initialsOf(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

/** Sidebar identity for the signed-in user: linked investor or staff member. */
export async function loadIdentityForShell(userId: string): Promise<{ name: string; role: 'investor' | 'staff'; initials: string }> {
  if (isDemoData()) {
    const investor = demoInvestorForAuthUser(userId);
    if (investor) return { name: investor.name, role: 'investor', initials: initialsOf(investor.name) };
    const staff = demoStaffForAuthUser(userId);
    if (staff) return { name: staff.name, role: 'staff', initials: initialsOf(staff.name) };
    return { name: '—', role: 'investor', initials: '—' };
  }
  const [investor, staff] = await Promise.all([
    prisma.investor.findUnique({ where: { authUserId: userId }, select: { name: true } }),
    prisma.staff.findUnique({ where: { authUserId: userId }, select: { name: true } }),
  ]);
  if (investor) return { name: investor.name, role: 'investor', initials: initialsOf(investor.name) };
  if (staff) return { name: staff.name, role: 'staff', initials: initialsOf(staff.name) };
  return { name: '—', role: 'investor', initials: '—' };
}
