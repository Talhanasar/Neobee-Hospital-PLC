import { prisma } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { handleRouteError } from '@/lib/http';
import { getRequestMetadata } from '@/lib/audit';
import { registerInvestment } from '@/lib/investments';
import { listInvestmentsSchema, registerInvestmentSchema } from '@/lib/validation';
import { type InvestmentCategory, InvestmentStatus } from '@/lib/generated/prisma/client';

export async function POST(request: Request): Promise<Response> {
  try {
    const staff = await requireStaff();
    const body = registerInvestmentSchema.safeParse(await request.json());
    if (!body.success) return Response.json({ error: body.error.flatten() }, { status: 400 });
    const created = await registerInvestment(body.data, staff.id, getRequestMetadata(request));
    return Response.json(
      {
        uid: created.uid,
        code: created.code,
        category: created.category,
        shares: created.shares,
        amount: created.amount,
        incentiveAmount: created.incentiveAmount,
        status: created.status,
        depositDate: created.depositDate,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    await requireStaff();
    const query = listInvestmentsSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const where = {
      ...(query.status ? { status: query.status as InvestmentStatus } : {}),
      ...(query.category ? { category: query.category as InvestmentCategory } : {}),
      ...(query.search
        ? {
            OR: [
              { investor: { name: { contains: query.search, mode: 'insensitive' as const } } },
              { uid: { contains: query.search, mode: 'insensitive' as const } },
              { code: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      prisma.investment.count({ where }),
      prisma.investment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          uid: true,
          code: true,
          category: true,
          shares: true,
          amount: true,
          incentiveAmount: true,
          status: true,
          depositDate: true,
          investor: { select: { name: true, phone: true } },
        },
      }),
    ]);
    return Response.json({ items, page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) });
  } catch (error) {
    return handleRouteError(error);
  }
}
