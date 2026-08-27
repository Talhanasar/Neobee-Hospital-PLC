import { prisma } from '@/lib/db';
import { getRequestMetadata, writeAuditLog, actionVerbs } from '@/lib/audit';
import { handleRouteError, jsonError } from '@/lib/http';
import { verifyQuerySchema } from '@/lib/validation';
import { ActorType } from '@/lib/generated/prisma/client';
import { z } from 'zod';

const WINDOW_MS = 5 * 60 * 1000;
const PER_IP_LIMIT = 20;
const GLOBAL_LIMIT = 250;

// ponytail: ceiling is a DB-backed counter; best-effort against casual enumeration, with Redis/Upstash + WAF as the upgrade path.
export async function GET(request: Request): Promise<Response> {
  try {
    const meta = getRequestMetadata(request);
    const query = verifyQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) {
      return Response.json({ error: z.treeifyError(query.error) }, { status: 400 });
    }

    const windowStart = new Date(Date.now() - WINDOW_MS);
    const recentByIp = await prisma.auditLog.count({
      where: {
        ipAddress: meta.ipAddress,
        action: actionVerbs.investmentVerifyLookup,
        createdAt: { gte: windowStart },
      },
    });
    if (recentByIp >= PER_IP_LIMIT) {
      return jsonError(429, 'RATE_LIMITED', 'Too many lookups');
    }

    const recentGlobal = await prisma.auditLog.count({
      where: {
        action: actionVerbs.investmentVerifyLookup,
        createdAt: { gte: windowStart },
      },
    });
    if (recentGlobal >= GLOBAL_LIMIT) {
      return jsonError(429, 'RATE_LIMITED', 'Too many lookups');
    }

    const select = {
      uid: true,
      code: true,
      shares: true,
      amount: true,
      category: true,
      status: true,
      depositDate: true,
      investor: { select: { name: true } },
    } as const;

    const record = query.data.code
      ? await prisma.investment.findUnique({ where: { code: query.data.code }, select })
      : await prisma.investment.findUnique({ where: { uid: query.data.uid }, select });

    await writeLookupAudit(meta.ipAddress, meta.userAgent, record?.uid ?? query.data.code ?? query.data.uid ?? 'unknown', Boolean(record));

    if (!record) {
      return jsonError(404, 'NOT_FOUND', 'Record not found');
    }

    return Response.json({
      uid: record.uid,
      code: record.code,
      investorName: record.investor.name,
      shares: record.shares,
      amount: record.amount,
      category: record.category,
      status: record.status,
      depositDate: record.depositDate,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function writeLookupAudit(ipAddress: string | null, userAgent: string | null, targetId: string, found: boolean): Promise<void> {
  await writeAuditLog({
    actorType: ActorType.PUBLIC,
    actorId: null,
    action: actionVerbs.investmentVerifyLookup,
    targetType: 'Investment',
    targetId,
    ipAddress,
    userAgent,
    metadata: { found },
  });
}
