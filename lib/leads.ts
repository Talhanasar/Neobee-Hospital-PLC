import { randomInt } from 'node:crypto';
import { prisma } from '@/lib/db';
import { actionVerbs, writeAuditLog } from '@/lib/audit';
import type { SubmitLeadInput } from '@/lib/validation';
import { demoCountNewLeads, demoCreateLead, demoListLeads, demoMarkLeadContacted, isDemoData } from '@/data/demo/store';

/**
 * Public interest leads ("Become a Shareholder"). Leads are marketing
 * contacts, not financial records: duplicates by phone are soft-warned
 * within a 7-day window rather than blocked, and rows are never deleted.
 */

// Same unambiguous alphabet as the receipt verification codes (§3): no I O 0 1.
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateLeadRef(): string {
  let ref = '';
  for (let i = 0; i < 4; i++) {
    ref += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  }
  return `NB-LEAD-${ref}`;
}

const DUPLICATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type RequestMeta = { ipAddress: string | null; userAgent: string | null };

export type CreateLeadResult =
  | { ok: true; lead: { id: string; ref: string } }
  | { ok: false; duplicateOf: string }; // ISO date of the recent submission

export async function createLead(
  input: SubmitLeadInput,
  meta: RequestMeta,
  opts?: { force?: boolean },
): Promise<CreateLeadResult> {
  if (isDemoData()) return demoCreateLead(input);
  if (!opts?.force) {
    const recent = await prisma.lead.findFirst({
      where: {
        phone: input.phone,
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (recent) {
      return { ok: false, duplicateOf: recent.createdAt.toISOString() };
    }
  }

  // Ref collisions are unlikely (32^4); retry on the unique constraint.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const lead = await prisma.$transaction(async (tx) => {
        const created = await tx.lead.create({
          data: {
            ref: generateLeadRef(),
            name: input.name,
            phone: input.phone,
            email: input.email ?? null,
            message: input.message ?? null,
          },
          select: { id: true, ref: true },
        });
        await writeAuditLog(
          {
            actorType: 'PUBLIC',
            actorId: null,
            action: actionVerbs.leadCreate,
            targetType: 'lead',
            targetId: created.id,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
          },
          tx,
        );
        return created;
      });
      return { ok: true, lead };
    } catch (error) {
      const isRefCollision = error instanceof Error && error.message.includes('Lead_ref_key');
      if (!isRefCollision || attempt === 4) throw error;
    }
  }
  throw new Error('unreachable');
}

export async function listLeads() {
  if (isDemoData()) return demoListLeads();
  return prisma.lead.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      ref: true,
      name: true,
      phone: true,
      email: true,
      message: true,
      status: true,
      contactedAt: true,
      createdAt: true,
    },
  });
}

export async function countNewLeads(): Promise<number> {
  if (isDemoData()) return demoCountNewLeads();
  return prisma.lead.count({ where: { status: 'NEW' } });
}

export async function markLeadContacted(
  leadId: string,
  staffId: string,
  meta: RequestMeta,
): Promise<void> {
  if (isDemoData()) {
    demoMarkLeadContacted(leadId);
    return;
  }
  await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.update({
      where: { id: leadId },
      data: {
        status: 'CONTACTED',
        contactedAt: new Date(),
        contactedByStaffId: staffId,
      },
      select: { id: true },
    });
    await writeAuditLog(
      {
        actorType: 'STAFF',
        actorId: staffId,
        action: actionVerbs.leadContact,
        targetType: 'lead',
        targetId: lead.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      tx,
    );
  });
}
