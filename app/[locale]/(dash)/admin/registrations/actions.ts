'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { AuthError, requireStaff } from '@/lib/auth';
import { writeAuditLog, actionVerbs } from '@/lib/audit';
import { ActorType } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/db';
import { demoApproveRegistration, isDemoData } from '@/data/demo/store';

export async function approveRegistrationAction(formData: FormData): Promise<void> {
  let staff;
  try {
    staff = await requireStaff();
  } catch (error) {
    if (error instanceof AuthError) return;
    throw error;
  }

  const investorId = String(formData.get('investorId') ?? '').trim();
  if (!investorId) return;

  if (isDemoData()) {
    demoApproveRegistration(investorId);
    revalidatePath('/admin/registrations');
    revalidatePath('/admin');
    revalidatePath('/portal');
    return;
  }

  const h = await headers();
  const realIp = h.get('x-real-ip')?.trim() ?? null;
  const forwardedFor = h.get('x-forwarded-for');
  const forwardedIp = forwardedFor ? forwardedFor.split(',')[0]?.trim() ?? null : null;

  // Idempotent claim: only a PENDING row flips to APPROVED.
  const claimed = await prisma.investor.updateMany({
    where: { id: investorId, approvalStatus: 'PENDING' },
    data: { approvalStatus: 'APPROVED' },
  });
  if (claimed.count === 0) return;

  await writeAuditLog({
    actorType: ActorType.STAFF,
    actorId: staff.id,
    action: actionVerbs.investorApprove,
    targetType: 'Investor',
    targetId: investorId,
    ipAddress: realIp ?? forwardedIp,
    userAgent: h.get('user-agent'),
  });
  revalidatePath('/admin/registrations');
  revalidatePath('/admin');
  revalidatePath('/portal');
}
