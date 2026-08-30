import { prisma } from '@/lib/db';
import type { AuditAction } from '@/lib/audit';

/**
 * DB-backed rate limiting: counts recent AuditLog rows for one action.
 * Passing `ipAddress` scopes the count to that address (null matches rows
 * with a NULL ip — one shared bucket); omitting it counts globally. This is
 * the shared form of the public verify endpoint's counter — a best-effort
 * ceiling; the upgrade path is Redis/Upstash plus a WAF.
 */
export async function countRecentAttempts(opts: {
  action: AuditAction;
  ipAddress?: string | null;
  windowMs: number;
}): Promise<number> {
  return prisma.auditLog.count({
    where: {
      ...(opts.ipAddress === undefined ? {} : { ipAddress: opts.ipAddress }),
      action: opts.action,
      createdAt: { gte: new Date(Date.now() - opts.windowMs) },
    },
  });
}
