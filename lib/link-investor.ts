import { prisma } from '@/lib/db';
import { writeAuditLog, actionVerbs } from '@/lib/audit';
import { ActorType } from '@/lib/generated/prisma/client';
import { normalizeBangladeshiPhone } from '@/lib/validation';

export async function linkInvestorToAuthUser(authUserId: string, phone: string): Promise<{ linked: boolean; investorId: string | null }> {
  let normalized: string;
  try {
    normalized = normalizeBangladeshiPhone(phone.startsWith('880') && !phone.startsWith('+') ? `+${phone}` : phone);
  } catch {
    return { linked: false, investorId: null };
  }

  return await prisma.$transaction(async (tx) => {
    const investor = await tx.investor.findUnique({ where: { phone: normalized } });
    if (!investor) return { linked: false, investorId: null };
    if (investor.authUserId !== null && investor.authUserId !== authUserId) return { linked: false, investorId: null };
    if (investor.authUserId === null) {
      const updated = await tx.investor.update({ where: { id: investor.id }, data: { authUserId } });
      // Audit only the actual link event — already-linked logins change nothing.
      await writeAuditLog({ actorType: ActorType.INVESTOR, actorId: authUserId, action: actionVerbs.investorLink, targetType: 'Investor', targetId: updated.id }, tx);
      return { linked: true, investorId: updated.id };
    }
    return { linked: true, investorId: investor.id };
  });
}
