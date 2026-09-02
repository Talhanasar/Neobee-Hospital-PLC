import type { Investor, Staff } from '@/lib/generated/prisma/client';
import { isAuthApiError } from '@supabase/supabase-js';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { demoInvestorForAuthUser, demoStaffForAuthUser, isDemoData } from '@/data/demo/store';

export class AuthError extends Error {
  readonly status: 401 | 403;

  constructor(message: string, status: 401 | 403) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

// Warn once per process instead of spamming a stack trace on every request.
let authFailureWarned = false;

function reportAuthFailure(error: unknown): void {
  if (authFailureWarned) {
    return;
  }
  authFailureWarned = true;
  // Only ever log error messages, never tokens or cookies.
  if (isAuthApiError(error) && error.status === 401) {
    console.warn(
      'Supabase auth unavailable (AuthApiError 401 Invalid API key). If your key looks like a JWT (eyJ...), the project\'s legacy API keys were likely disabled — replace NEXT_PUBLIC_SUPABASE_ANON_KEY with the new sb_publishable_... key (Dashboard → Settings → API Keys). Run: pnpm check:env',
    );
  } else {
    console.warn(`Supabase auth call failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getAuthUser(): Promise<{ id: string } | null> {
  // Demo mode: a signed cookie stands in for the Supabase session —
  // the demo presentation must run with zero external dependencies.
  if (isDemoData()) {
    const demoRole = (await cookies()).get('neobee-demo-role')?.value;
    if (demoRole === 'investor') return { id: 'demo-auth-investor' };
    if (demoRole === 'investor-kisti') return { id: 'demo-auth-investor-kisti' };
    if (demoRole === 'admin') return { id: 'demo-auth-admin' };
    return null;
  }
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      if (error) {
        reportAuthFailure(error);
      }
      return null;
    }
    return { id: data.user.id };
  } catch (error) {
    reportAuthFailure(error);
    return null;
  }
}

async function loadAuthUserId(): Promise<string> {
  const user = await getAuthUser();
  if (!user) {
    throw new AuthError('Unauthenticated', 401);
  }
  return user.id;
}

async function getStaffForUser(authUserId: string): Promise<Staff | null> {
  if (isDemoData()) return demoStaffForAuthUser(authUserId) as unknown as Staff | null;
  return prisma.staff.findUnique({ where: { authUserId } });
}

export async function requireStaff(): Promise<Staff> {
  const authUserId = await loadAuthUserId();
  const staff = await getStaffForUser(authUserId);
  if (!staff || !staff.isActive) {
    throw new AuthError('Forbidden', 403);
  }
  return staff;
}

export async function requireAdmin(): Promise<Staff> {
  const staff = await requireStaff();
  if (staff.role !== 'ADMIN') {
    throw new AuthError('Forbidden', 403);
  }
  return staff;
}

export async function requireInvestor(): Promise<Investor> {
  const authUserId = await loadAuthUserId();
  if (isDemoData()) {
    const demoInvestor = demoInvestorForAuthUser(authUserId);
    if (!demoInvestor) throw new AuthError('Forbidden', 403);
    return demoInvestor as unknown as Investor;
  }
  const investor = await prisma.investor.findUnique({ where: { authUserId } });
  if (!investor) {
    throw new AuthError('Forbidden', 403);
  }
  return investor;
}

export async function assertOwnsInvestment(investorId: string, investmentId: string): Promise<void> {
  if (isDemoData()) {
    const { demoAssertOwnsInvestment } = await import('@/data/demo/store');
    if (!demoAssertOwnsInvestment(investorId, investmentId)) throw new AuthError('Forbidden', 403);
    return;
  }
  const investment = await prisma.investment.findUnique({ where: { id: investmentId } });
  if (!investment || investment.investorId !== investorId) {
    throw new AuthError('Forbidden', 403);
  }
}

export const getSessionContext = cache(
  async (): Promise<{
    user: Awaited<ReturnType<typeof getAuthUser>>;
    isStaff: boolean;
    isAdmin: boolean;
    isInvestor: boolean;
  }> => {
    const user = await getAuthUser();
    if (!user) {
      return { user: null, isStaff: false, isAdmin: false, isInvestor: false };
    }
    const [staff, investor] = await Promise.all([
      getStaffForUser(user.id),
      isDemoData()
        ? Promise.resolve(demoInvestorForAuthUser(user.id) as unknown as Investor | null)
        : prisma.investor.findUnique({ where: { authUserId: user.id } }),
    ]);
    const isStaff = staff !== null && staff.isActive;
    return {
      user,
      isStaff,
      isAdmin: isStaff && staff.role === 'ADMIN',
      isInvestor: investor !== null,
    };
  },
);
