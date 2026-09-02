import { prisma } from '@/lib/db';
import { getSettings, type Settings } from '@/lib/settings';
import type { InvestmentCategory } from '@/lib/money';
import type { ReceiptData } from '@/lib/receipt';
import type { ListInvestmentsInput } from '@/lib/validation';
import {
  demoGetPublicSummary,
  demoGetReceiptData,
  demoListPaymentsForInvestment,
  demoListPendingRequests,
  demoListRequestsForInvestor,
  demoListInvestmentsForInvestor,
  demoListInvestmentsPage,
  demoListSchedulesForInvestor,
  demoGetAdminStats,
  demoGetRequestForReview,
  demoListRegistrations,
  demoCountPendingRegistrations,
  isDemoData,
} from '@/data/demo/store';

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
  if (isDemoData()) return demoGetPublicSummary() as PublicSummary;
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
export async function getReceiptData(investmentId: string, opts?: { installmentNo?: number }): Promise<ReceiptData | null> {
  if (isDemoData()) return demoGetReceiptData(investmentId, opts?.installmentNo) as ReceiptData | null;
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
      paymentPlan: true,
    },
  });
  if (!row) return null;

  // No specific kisti requested — return the legacy share-level receipt.
  if (!opts?.installmentNo) {
    let totalAmount: number | undefined;
    let paidToDate: number | undefined;
    if (row.paymentPlan === 'INSTALLMENT') {
      totalAmount = row.shares * row.sharePrice;
      const ledger = await prisma.transaction.aggregate({
        where: { investmentId, type: 'DEPOSIT' },
        _sum: { amount: true },
      });
      paidToDate = ledger._sum.amount ?? 0;
    }
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
      paymentPlan: row.paymentPlan,
      totalAmount,
      paidToDate,
    };
  }

  // Per-kisti receipt: look up the schedule and its transaction.
  const schedule = await prisma.installmentSchedule.findFirst({
    where: { investmentId, installmentNo: opts.installmentNo },
    select: { id: true, installmentNo: true, amount: true, status: true },
  });
  if (!schedule || schedule.status !== 'PAID') return null;

  const tx = await prisma.transaction.findFirst({
    where: { installmentScheduleId: schedule.id, type: 'DEPOSIT' },
    select: { depositMethod: true, depositDate: true },
  });

  const paidToDateAgg = await prisma.installmentSchedule.aggregate({
    where: { investmentId, status: 'PAID' },
    _sum: { amount: true },
  });
  const totalAmount = row.shares * row.sharePrice;
  const paidToDate = paidToDateAgg._sum.amount ?? 0;

  return {
    uid: row.uid,
    code: row.code,
    investorName: row.investor.name,
    investorPhone: row.investor.phone,
    nationalIdNumber: row.investor.nationalIdNumber,
    category: row.category,
    shares: row.shares,
    sharePrice: row.sharePrice,
    amount: schedule.amount,
    isEntrepreneur: row.isEntrepreneur,
    incentiveAmount: row.incentiveAmount,
    depositMethod: tx?.depositMethod ?? row.depositMethod,
    depositRef: null,
    depositDate: tx?.depositDate ?? row.depositDate,
    status: row.status,
    issuedAt: row.createdAt,
    paymentPlan: row.paymentPlan,
    installmentNo: schedule.installmentNo,
    kistiRef: `${row.uid}-K${schedule.installmentNo}`,
    totalAmount,
    paidToDate,
  };
}

// Must never be exposed on a public route.
export async function getInvestmentIdForCode(code: string): Promise<string | null> {
  const row = await prisma.investment.findUnique({ where: { code }, select: { id: true } });
  return row?.id ?? null;
}

export type InvestmentPaymentRow = {
  id: string;
  amount: number;
  type: 'DEPOSIT' | 'REFUND' | 'CORRECTION' | 'DISTRIBUTION';
  depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING' | null;
  depositDate: Date | null;
  note: string | null;
  createdAt: Date;
  recordedByName: string | null;
};

// Staff-only: payment history for one investment (admin receipts page).
export async function listPaymentsForInvestment(investmentId: string): Promise<InvestmentPaymentRow[]> {
  if (isDemoData()) return demoListPaymentsForInvestment(investmentId) as InvestmentPaymentRow[];
  const rows = await prisma.transaction.findMany({
    where: { investmentId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      amount: true,
      type: true,
      depositMethod: true,
      depositDate: true,
      note: true,
      createdAt: true,
      recordedByStaff: { select: { name: true } },
    },
  });
  return rows.map(({ recordedByStaff, ...rest }) => ({
    ...rest,
    recordedByName: recordedByStaff?.name ?? null,
  }));
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
  if (isDemoData()) return demoGetAdminStats();
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
  category: InvestmentCategory;
  shares: number;
  amount: number;
  incentiveAmount: number;
  status: 'PENDING' | 'CONFIRMED';
  depositDate: Date;
  depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING';
  investorId: string;
  investorName: string;
  investorPhone: string;
  paymentPlan: 'FULL' | 'INSTALLMENT';
  kistis: Array<{ installmentNo: number; dueDate: Date; amount: number; status: string }>;
};
export type InvestmentListResult = { items: InvestmentListRow[]; page: number; pageSize: number; total: number; totalPages: number };
export async function listInvestmentsPage(input: ListInvestmentsInput): Promise<InvestmentListResult> {
  if (isDemoData()) return demoListInvestmentsPage(input) as InvestmentListResult;
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
        paymentPlan: true,
        installmentSchedules: {
          orderBy: { installmentNo: 'asc' as const },
          select: { installmentNo: true, dueDate: true, amount: true, status: true },
        },
        investor: { select: { id: true, name: true, phone: true } },
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
      investorId: row.investor.id,
      investorName: row.investor.name,
      investorPhone: row.investor.phone,
      paymentPlan: row.paymentPlan,
      kistis: row.installmentSchedules,
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
  category: InvestmentCategory;
  shares: number;
  amount: number;
  incentiveAmount: number;
  status: 'PENDING' | 'CONFIRMED';
  depositDate: Date;
  confirmedAt: Date | null;
  depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING';
  paymentPlan: 'FULL' | 'INSTALLMENT';
  sharePrice: number;
  totalAmount: number; // face value: shares × sharePrice (undiscounted)
  fullyPaidAt: Date | null;
};

// Ownership boundary: this query must stay scoped to exactly one investorId and never widen.
export async function listInvestmentsForInvestor(investorId: string): Promise<PortalRow[]> {
  if (isDemoData()) return demoListInvestmentsForInvestor(investorId) as PortalRow[];
  const rows = await prisma.investment.findMany({
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
      paymentPlan: true,
      sharePrice: true,
      fullyPaidAt: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    totalAmount: row.shares * row.sharePrice,
  }));
}

export type PortalScheduleRow = {
  id: string;
  investmentId: string;
  installmentNo: number;
  dueDate: Date;
  amount: number;
  status: 'SCHEDULED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
};

// Kisti schedule rows for the investor's own investments, keyed by investment id.
export async function listSchedulesForInvestor(investorId: string): Promise<Map<string, PortalScheduleRow[]>> {
  if (isDemoData()) return demoListSchedulesForInvestor(investorId) as unknown as Map<string, PortalScheduleRow[]>;
  const schedules = await prisma.installmentSchedule.findMany({
    where: { investment: { investorId } },
    orderBy: [{ investmentId: 'asc' }, { installmentNo: 'asc' }],
    select: {
      id: true,
      investmentId: true,
      installmentNo: true,
      dueDate: true,
      amount: true,
      status: true,
    },
  });
  const map = new Map<string, PortalScheduleRow[]>();
  for (const s of schedules) {
    const list = map.get(s.investmentId) ?? [];
    list.push(s);
    map.set(s.investmentId, list);
  }
  return map;
}

export type RequestListRow = {
  id: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  kind: 'SHARE_PURCHASE' | 'PAYMENT';
  targetInvestmentUid: string | null;
  installmentNo: number | null;
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
  if (isDemoData()) return demoListRequestsForInvestor(investorId) as unknown as RequestListRow[];
  return await prisma.investmentRequest.findMany({
    where: { investorId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      kind: true,
      targetInvestment: { select: { uid: true } },
      installmentNo: true,
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
  }).then((rows) =>
    rows.map(({ targetInvestment, ...rest }) => ({
      ...rest,
      targetInvestmentUid: targetInvestment?.uid ?? null,
    })),
  );
}

export type PendingRequestAdminRow = {
  id: string;
  investorId: string;
  investorName: string;
  investorPhone: string;
  kind: 'SHARE_PURCHASE' | 'PAYMENT';
  targetInvestmentUid: string | null;
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
  if (isDemoData()) return demoListPendingRequests() as unknown as PendingRequestAdminRow[];
  const rows = await prisma.investmentRequest.findMany({
    where: { status: 'SUBMITTED' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      investorId: true,
      investor: { select: { name: true, phone: true } },
      kind: true,
      targetInvestment: { select: { uid: true } },
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
  return rows.map(({ targetInvestment, investor, ...rest }) => ({
    ...rest,
    investorName: investor.name,
    investorPhone: investor.phone,
    targetInvestmentUid: targetInvestment?.uid ?? null,
  }));
}

export type RequestForReview = {
  id: string;
  investorId: string;
  investorName: string;
  investorPhone: string;
  kind: 'SHARE_PURCHASE' | 'PAYMENT';
  targetInvestmentId: string | null;
  targetInvestmentUid: string | null;
  shares: number;
  entrepreneurRequested: boolean;
  paymentPlan: 'FULL' | 'INSTALLMENT' | null;
  installmentNo: number | null;
  sharePrice: number;
  incentivePerShare: number;
  amount: number;
  depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING';
  depositRef: string | null;
  depositDate: Date;
  slipFileKey: string | null;
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
  if (isDemoData()) return demoGetRequestForReview(id) as unknown as RequestForReview | null;
  const row = await prisma.investmentRequest.findUnique({
    where: { id },
    select: {
      id: true,
      investorId: true,
      investor: { select: { name: true, phone: true } },
      kind: true,
      targetInvestmentId: true,
      targetInvestment: { select: { uid: true } },
      shares: true,
      entrepreneurRequested: true,
      paymentPlan: true,
      installmentNo: true,
      sharePrice: true,
      incentivePerShare: true,
      amount: true,
      depositMethod: true,
      depositRef: true,
      depositDate: true,
      slipFileKey: true,
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
  const { targetInvestment, investor, reviewedByStaff, ...rest } = row;
  return {
    ...rest,
    investorName: investor.name,
    investorPhone: investor.phone,
    reviewedByName: reviewedByStaff?.name ?? null,
    targetInvestmentUid: targetInvestment?.uid ?? null,
  };
}

export type RegistrationRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  nationalIdNumber: string | null;
  approvalStatus: 'PENDING' | 'APPROVED';
  createdAt: Date;
  investmentCount: number;
};

// Staff-only: the registration approval queue (newest first, counts included).
export async function listRegistrations(): Promise<RegistrationRow[]> {
  if (isDemoData()) return demoListRegistrations() as unknown as RegistrationRow[];
  const rows = await prisma.investor.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      nationalIdNumber: true,
      approvalStatus: true,
      createdAt: true,
      _count: { select: { investments: true } },
    },
  });
  return rows.map(({ _count, ...rest }) => ({ ...rest, investmentCount: _count.investments }));
}

export async function countPendingRegistrations(): Promise<number> {
  if (isDemoData()) return demoCountPendingRegistrations();
  return prisma.investor.count({ where: { approvalStatus: 'PENDING' } });
}

export type InvestorDetail = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  nationalIdNumber: string | null;
  address: string | null;
  approvalStatus: 'PENDING' | 'APPROVED';
  createdAt: Date;
  investments: Array<{
    id: string;
    uid: string;
    paymentPlan: 'FULL' | 'INSTALLMENT';
    shares: number;
    amount: number;
    category: InvestmentCategory;
    status: 'PENDING' | 'CONFIRMED';
    depositDate: Date;
    depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING';
    fullyPaidAt: Date | null;
    certificateRef: string | null;
    kistis: Array<{ installmentNo: number; dueDate: Date; amount: number; status: string }>;
  }>;
  requests: Array<{
    id: string;
    kind: 'SHARE_PURCHASE' | 'PAYMENT';
    shares: number;
    amount: number;
    status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    depositDate: Date;
    createdAt: Date;
  }>;
};

// Staff-only: one investor's full profile with their investments, kisti
// schedules, and request history.
export async function getInvestorDetail(id: string): Promise<InvestorDetail | null> {
  if (isDemoData()) {
    const demo = (await import('@/data/demo/store')).demoGetInvestorDetail(id);
    if (!demo) return null;
    return demo as unknown as InvestorDetail;
  }
  const row = await prisma.investor.findUnique({
    where: { id },
    include: {
      investments: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          uid: true,
          paymentPlan: true,
          shares: true,
          amount: true,
          category: true,
          status: true,
          depositDate: true,
          depositMethod: true,
          fullyPaidAt: true,
          certificate: { select: { id: true } },
          installmentSchedules: {
            orderBy: { installmentNo: 'asc' as const },
            select: { installmentNo: true, dueDate: true, amount: true, status: true },
          },
        },
      },
      requests: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          kind: true,
          shares: true,
          amount: true,
          status: true,
          depositDate: true,
          createdAt: true,
        },
      },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    nationalIdNumber: row.nationalIdNumber,
    address: row.address,
    approvalStatus: row.approvalStatus,
    createdAt: row.createdAt,
    investments: row.investments.map((i) => ({
      id: i.id,
      uid: i.uid,
      paymentPlan: i.paymentPlan,
      shares: i.shares,
      amount: i.amount,
      category: i.category,
      status: i.status,
      depositDate: i.depositDate,
      depositMethod: i.depositMethod,
      fullyPaidAt: i.fullyPaidAt,
      certificateRef: i.certificate ? `${i.uid}-CERT` : null,
      kistis: i.installmentSchedules,
    })),
    requests: row.requests,
  };
}
