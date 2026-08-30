'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { AuthError, requireStaff } from '@/lib/auth';
import { markLeadContacted } from '@/lib/leads';

export async function markLeadContactedAction(formData: FormData): Promise<void> {
  let staff;
  try {
    staff = await requireStaff();
  } catch (error) {
    if (error instanceof AuthError) return;
    throw error;
  }

  const leadId = String(formData.get('leadId') ?? '').trim();
  if (!leadId) return;

  const h = await headers();
  const realIp = h.get('x-real-ip')?.trim() ?? null;
  const forwardedFor = h.get('x-forwarded-for');
  const forwardedIp = forwardedFor ? forwardedFor.split(',')[0]?.trim() ?? null : null;

  await markLeadContacted(leadId, staff.id, {
    ipAddress: realIp ?? forwardedIp,
    userAgent: h.get('user-agent'),
  });
  revalidatePath('/admin/leads');
}
