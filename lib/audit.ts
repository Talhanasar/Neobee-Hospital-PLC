import type { ActorType, AuditLog, Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/db';

export const actionVerbs = Object.freeze({
  investmentRegister: 'investment.register',
  investmentConfirm: 'investment.confirm',
  investmentVerifyLookup: 'investment.verify_lookup',
  investorLink: 'investor.link',
  settingUpdate: 'setting.update',
  fileUpload: 'file.upload',
  fileDelete: 'file.delete',
  requestSubmit: 'request.submit',
  requestApprove: 'request.approve',
  requestReject: 'request.reject',
  investorRegister: 'investor.register',
} as const);

export type AuditAction = (typeof actionVerbs)[keyof typeof actionVerbs];

export function getRequestMetadata(request: Request): { ipAddress: string | null; userAgent: string | null } {
  const realIp = request.headers.get('x-real-ip')?.trim() ?? null;
  const forwardedFor = request.headers.get('x-forwarded-for');
  const forwardedIp = forwardedFor ? forwardedFor.split(',')[0]?.trim() ?? null : null;
  // Null IPs share one bucket so callers cannot bypass limits by omitting headers.
  const ipAddress = realIp ?? forwardedIp;
  const userAgent = request.headers.get('user-agent');
  return { ipAddress, userAgent };
}

export type AuditEntry = {
  actorType: ActorType;
  actorId: string | null;
  action: AuditAction;
  targetType: string;
  targetId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: AuditLog['metadata'];
};

type AuditClient = Pick<Prisma.TransactionClient, 'auditLog'>;

const defaultAuditClient: AuditClient = prisma;

export async function writeAuditLog(entry: AuditEntry, client: AuditClient = defaultAuditClient): Promise<void> {
  // Must use the same transaction as the mutation it describes so rolled-back changes do not leave phantom logs.
  await client.auditLog.create({
    data: {
      actorType: entry.actorType,
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      metadata: entry.metadata ?? undefined,
    },
  });
}

// never put PII, secrets, full request bodies, or NID numbers in metadata.
