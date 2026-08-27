import { prisma } from '@/lib/db';
import { getSettings, type Settings } from '@/lib/settings';
import type { ReceiptData } from '@/lib/receipt';
import type { ListInvestmentsInput } from '@/lib/validation';

export type PublicSummary = {
  totalRaised: number;
  percentageOfTarget: number;
  sharesSubscribed: number;
  foundingPhaseProgress: number;
  foundingRaised: number;
  entrepreneurSlotsFilled: number;
  settings: Settings;
};

export async function getPublicSummary(): Promise<PublicSummary> {
  const settings = await getSettings();
  const [raised, sharesSubscribed, foundingPhase, entrepreneurSlots] = await Promise.all([
    prisma.investment.aggregate({ where: { status: 'CONFIRMED' }, _sum: { amount: true } }),
    prisma.investment.aggregate({ where: { status: 'CONFIRMED' }, _sum: { shares: true } }),
    prisma.investment.aggregate({ where: { status: 'CONFIRMED', shares: { gte: 10 } }, _sum: { amount: true } }),
    prisma.investment.count({ where: { status: 'CONFIRMED', isEntrepreneur: true } }),
  ]);
  return {
    totalRaised: raised._sum.amount ?? 0,
    percentageOfTarget: Math.min(100, ((raised._sum.amount ?? 0) / settings.TARGET_AMOUNT) * 100),
    sharesSubscribed: sharesSubscribed._sum.shares ?? 0,
    foundingPhaseProgress: Math.min(100, ((foundingPhase._sum.amount ?? 0) / settings.FOUNDING_AMOUNT) * 100),
    foundingRaised: foundingPhase._sum.amount ?? 0,
    entrepreneurSlotsFilled: entrepreneurSlots,
    settings,
  };
}

// Callers are responsible for authorization before exposing this data.
export async function getReceiptData(investmentId: string): Promise<ReceiptData | null> {
  const row = await prisma.investment.findUnique({
    where: { id: investmentId },
    select: {
      uid: true,
      code: true,
      investor: { select: { name: true, phone: true, email: true, nationalIdNumber: true } },
      category: true,
      shares: true,
      sharePrice: true,
      amount: true,
      isEntrepreneur: true,
      incentiveAmount: true,
      depositMethod: true,
      depositRef: true,
      depositDate: true,
      status: true,
      createdAt: true,
    },
  });
  if (!row) return null;
  return {
    uid: row.uid,
    code: row.code,
    investorName: row.investor.name,
    investorPhone: row.investor.phone,
    nationalIdNumber: row.investor.nationalIdNumber,
    category: row.category,
    shares: row.shares,
    sharePrice: row.sharePrice,
    amount: row.amount,
    isEntrepreneur: row.isEntrepreneur,
    incentiveAmount: row.incentiveAmount,
    depositMethod: row.depositMethod,
    depositRef: row.depositRef,
    depositDate: row.depositDate,
    status: row.status,
    issuedAt: row.createdAt,
  };
}

// Must never be exposed on a public route.
export async function getInvestmentIdForCode(code: string): Promise<string | null> {
  const row = await prisma.investment.findUnique({ where: { code }, select: { id: true } });
  return row?.id ?? null;
}

export type AdminStats = {
  totalSubscribed: number;
  totalCount: number;
  confirmedAmount: number;
  confirmedCount: number;
  pendingAmount: number;
  pendingCount: number;
  incentivesDue: number;
  entrepreneurCount: number;
  pendingRequestCount: number;
};
export async function getAdminStats(): Promise<AdminStats> {
  const [total, confirmed, pending, incentivesDue, entrepreneurCount, pendingRequestCount] = await Promise.all([
    prisma.investment.aggregate({ _sum: { amount: true }, _count: true }),
    prisma.investment.aggregate({ where: { status: 'CONFIRMED' }, _sum: { amount: true }, _count: true }),
    prisma.investment.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true }, _count: true }),
    prisma.investment.aggregate({ _sum: { incentiveAmount: true } }),
    prisma.investment.count({ where: { isEntrepreneur: true } }),
    prisma.investmentRequest.count({ where: { status: 'SUBMITTED' } }),
  ]);
  return {
    totalSubscribed: total._sum.amount ?? 0,
    totalCount: total._count,
    confirmedAmount: confirmed._sum.amount ?? 0,
    confirmedCount: confirmed._count,
    pendingAmount: pending._sum.amount ?? 0,
    pendingCount: pending._count,
    incentivesDue: incentivesDue._sum.incentiveAmount ?? 0,
    entrepreneurCount,
    pendingRequestCount,
  };
}

export type InvestmentListRow = {
  id: string;
  uid: string;
  code: string;
  category: 'SHAREHOLDER' | 'PREMIUM' | 'DIRECTOR';
  shares: number;
  amount: number;
  incentiveAmount: number;
  status: 'PENDING' | 'CONFIRMED';
  depositDate: Date;
  depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING';
  investorName: string;
  investorPhone: string;
};
export type InvestmentListResult = { items: InvestmentListRow[]; page: number; pageSize: number; total: number; totalPages: number };
export async function listInvestmentsPage(input: ListInvestmentsInput): Promise<InvestmentListResult> {
  const where = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.search
      ? {
          OR: [
            { investor: { name: { contains: input.search, mode: 'insensitive' as const } } },
            { uid: { contains: input.search, mode: 'insensitive' as const } },
            { code: { contains: input.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [total, items] = await Promise.all([
    prisma.investment.count({ where }),
    prisma.investment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        id: true,
        uid: true,
        code: true,
        category: true,
        shares: true,
        amount: true,
        incentiveAmount: true,
        status: true,
        depositDate: true,
        depositMethod: true,
        investor: { select: { name: true, phone: true } },
      },
    }),
  ]);
  return {
    items: items.map((row) => ({
      id: row.id,
      uid: row.uid,
      code: row.code,
      category: row.category,
      shares: row.shares,
      amount: row.amount,
      incentiveAmount: row.incentiveAmount,
      status: row.status,
      depositDate: row.depositDate,
      depositMethod: row.depositMethod,
      investorName: row.investor.name,
      investorPhone: row.investor.phone,
    })),
    page: input.page,
    pageSize: input.pageSize,
    total,
    totalPages: Math.ceil(total / input.pageSize),
  };
}

export type PortalRow = {
  id: string;
  uid: string;
  code: string;
  category: 'SHAREHOLDER' | 'PREMIUM' | 'DIRECTOR';
  shares: number;
  amount: number;
  incentiveAmount: number;
  status: 'PENDING' | 'CONFIRMED';
  depositDate: Date;
  confirmedAt: Date | null;
  depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING';
};

// Ownership boundary: this query must stay scoped to exactly one investorId and never widen.
export async function listInvestmentsForInvestor(investorId: string): Promise<PortalRow[]> {
  return await prisma.investment.findMany({
    where: { investorId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      uid: true,
      code: true,
      category: true,
      shares: true,
      amount: true,
      incentiveAmount: true,
      status: true,
      depositDate: true,
      confirmedAt: true,
      depositMethod: true,
    },
  });
}

export type RequestListRow = {
  id: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  shares: number;
  entrepreneurRequested: boolean;
  sharePrice: number;
  incentivePerShare: number;
  amount: number;
  depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING';
  depositRef: string | null;
  depositDate: Date;
  note: string | null;
  reviewNote: string | null;
  reviewedByStaffId: string | null;
  reviewedAt: Date | null;
  investmentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function listRequestsForInvestor(investorId: string): Promise<RequestListRow[]> {
  return await prisma.investmentRequest.findMany({
    where: { investorId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      shares: true,
      entrepreneurRequested: true,
      sharePrice: true,
      incentivePerShare: true,
      amount: true,
      depositMethod: true,
      depositRef: true,
      depositDate: true,
      note: true,
      reviewNote: true,
      reviewedByStaffId: true,
      reviewedAt: true,
      investmentId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export type PendingRequestAdminRow = {
  id: string;
  investorId: string;
  investorName: string;
  investorPhone: string;
  shares: number;
  entrepreneurRequested: boolean;
  sharePrice: number;
  incentivePerShare: number;
  amount: number;
  depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING';
  depositRef: string | null;
  depositDate: Date;
  note: string | null;
  createdAt: Date;
};

export async function listPendingRequests(): Promise<PendingRequestAdminRow[]> {
  const rows = await prisma.investmentRequest.findMany({
    where: { status: 'SUBMITTED' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      investorId: true,
      investor: { select: { name: true, phone: true } },
      shares: true,
      entrepreneurRequested: true,
      sharePrice: true,
      incentivePerShare: true,
      amount: true,
      depositMethod: true,
      depositRef: true,
      depositDate: true,
      note: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    investorName: row.investor.name,
    investorPhone: row.investor.phone,
  }));
}

export type RequestForReview = {
  id: string;
  investorId: string;
  investorName: string;
  investorPhone: string;
  shares: number;
  entrepreneurRequested: boolean;
  sharePrice: number;
  incentivePerShare: number;
  amount: number;
  depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING';
  depositRef: string | null;
  depositDate: Date;
  note: string | null;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  reviewNote: string | null;
  reviewedByStaffId: string | null;
  reviewedByName: string | null;
  reviewedAt: Date | null;
  investmentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function getRequestForReview(id: string): Promise<RequestForReview | null> {
  const row = await prisma.investmentRequest.findUnique({
    where: { id },
    select: {
      id: true,
      investorId: true,
      investor: { select: { name: true, phone: true } },
      shares: true,
      entrepreneurRequested: true,
      sharePrice: true,
      incentivePerShare: true,
      amount: true,
      depositMethod: true,
      depositRef: true,
      depositDate: true,
      note: true,
      status: true,
      reviewNote: true,
      reviewedByStaffId: true,
      reviewedByStaff: { select: { name: true } },
      reviewedAt: true,
      investmentId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!row) return null;
  return {
    ...row,
    investorName: row.investor.name,
    investorPhone: row.investor.phone,
    reviewedByName: row.reviewedByStaff?.name ?? null,
  };
}
