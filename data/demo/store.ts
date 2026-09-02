/**
 * Demo data store — the in-repo dataset, served in-memory.
 *
 * THE switch: `isDemoData()` is the one function that decides where data
 * comes from. Set DEMO_DATA=true in .env (or run `node scripts/demo.mjs`)
 * and every read below serves data/demo/dataset.ts instead of Postgres;
 * leave it unset and nothing here is ever called.
 *
 * Mutations are held in a module-level array so a demo click (confirm,
 * approve, mark contacted) visibly changes the next render — nothing is
 * persisted anywhere, and a server restart resets the story.
 */
import {
  DEMO_INVESTMENTS,
  DEMO_INVESTORS,
  DEMO_LEADS,
  DEMO_REQUESTS,
  DEMO_SCHEDULES,
  DEMO_SETTINGS,
  DEMO_STAFF,
  DEMO_TRANSACTIONS,
  type DemoInvestmentRequest,
  type DemoLead,
} from './dataset';

export function isDemoData(): boolean {
  return process.env.DEMO_DATA === 'true';
}

// Fresh mutable copies per server start (dataset.ts constants stay pristine).
let investments = [...DEMO_INVESTMENTS];
let requests: DemoInvestmentRequest[] = [...DEMO_REQUESTS];
let leads: DemoLead[] = [...DEMO_LEADS];
let investors = [...DEMO_INVESTORS];
let schedules = [...DEMO_SCHEDULES];
let settings: Record<string, number> = { ...DEMO_SETTINGS };
const demoPasswords: Record<string, string> = {
  // authUserId → password; the seeded demo identities.
  'demo-auth-investor': 'demo-investor-2026',
  'demo-auth-investor-kisti': 'demo-investor-2026',
  'demo-auth-admin': 'demo-admin-2026',
};
let nextUidSeq = 9020;
const demoTransactions = [...DEMO_TRANSACTIONS];

const investorById = (id: string) => investors.find((i) => i.id === id);
const investmentById = (id: string) => investments.find((i) => i.id === id);

export type DemoPortalRow = {
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
  paymentPlan: 'FULL' | 'INSTALLMENT';
  sharePrice: number;
  totalAmount: number; // face value: shares × sharePrice (undiscounted)
  fullyPaidAt: Date | null;
};

export function demoListInvestmentsForInvestor(investorId: string): DemoPortalRow[] {
  return investments
    .filter((i) => i.investorId === investorId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(({ id, uid, code, category, shares, amount, incentiveAmount, status, depositDate, confirmedAt, depositMethod, sharePrice }) => ({
      id,
      uid,
      code,
      category,
      shares,
      amount,
      incentiveAmount,
      status,
      depositDate,
      confirmedAt,
      depositMethod,
      paymentPlan: i_paymentPlanOf(id),
      sharePrice,
      totalAmount: shares * sharePrice,
      fullyPaidAt: i_fullyPaidAtOf(id),
    }));
}

// Kisti schedule rows for the investor's own investments, keyed by investment id.
export function demoListSchedulesForInvestor(investorId: string): Map<string, DemoPortalRow[] extends never ? never : Array<{ id: string; investmentId: string; installmentNo: number; dueDate: Date; amount: number; status: 'SCHEDULED' | 'PAID' | 'OVERDUE' | 'CANCELLED' }>> {
  const owned = new Set(investments.filter((i) => i.investorId === investorId).map((i) => i.id));
  const map = new Map<string, Array<{ id: string; investmentId: string; installmentNo: number; dueDate: Date; amount: number; status: 'SCHEDULED' | 'PAID' | 'OVERDUE' | 'CANCELLED' }>>();
  for (const s of schedules) {
    if (!owned.has(s.investmentId)) continue;
    const list = map.get(s.investmentId) ?? [];
    list.push({ ...s });
    map.set(s.investmentId, list);
  }
  return map;
}

// payments-plan/certificate helpers over the mutable investments array
function i_paymentPlanOf(id: string): 'FULL' | 'INSTALLMENT' {
  return investments.find((i) => i.id === id)?.paymentPlan ?? 'FULL';
}
function i_fullyPaidAtOf(id: string): Date | null {
  return investments.find((i) => i.id === id)?.fullyPaidAt ?? null;
}

export function demoListRequestsForInvestor(investorId: string) {
  return requests
    .filter((r) => r.investorId === investorId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((r) => ({ ...r, targetInvestmentUid: investmentById(r.targetInvestmentId ?? '')?.uid ?? null }));
}

export function demoListPendingRequests() {
  return requests
    .filter((r) => r.status === 'SUBMITTED')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((r) => {
      const inv = investorById(r.investorId);
      return {
        ...r,
        targetInvestmentUid: investmentById(r.targetInvestmentId ?? '')?.uid ?? null,
        investorName: inv?.name ?? '—',
        investorPhone: inv?.phone ?? '—',
      };
    });
}

export function demoGetRequestForReview(id: string) {
  const r = requests.find((x) => x.id === id);
  if (!r) return null;
  const inv = investorById(r.investorId);
  const staff = r.reviewedByStaffId ? DEMO_STAFF.find((s) => s.id === r.reviewedByStaffId) : null;
  return {
    ...r,
    investorName: inv?.name ?? '—',
    investorPhone: inv?.phone ?? '—',
    reviewedByName: staff?.name ?? null,
    targetInvestmentUid: investmentById(r.targetInvestmentId ?? '')?.uid ?? null,
  };
}

export function demoGetAdminStats() {
  const total = investments.reduce((s, i) => s + i.amount, 0);
  const confirmed = investments.filter((i) => i.status === 'CONFIRMED');
  const pending = investments.filter((i) => i.status === 'PENDING');
  return {
    totalSubscribed: total,
    totalCount: investments.length,
    confirmedAmount: confirmed.reduce((s, i) => s + i.amount, 0),
    confirmedCount: confirmed.length,
    pendingAmount: pending.reduce((s, i) => s + i.amount, 0),
    pendingCount: pending.length,
    incentivesDue: investments.reduce((s, i) => s + i.incentiveAmount, 0),
    entrepreneurCount: investments.filter((i) => i.isEntrepreneur).length,
    pendingRequestCount: requests.filter((r) => r.status === 'SUBMITTED').length,
  };
}

export function demoGetPublicSummary() {
  const confirmed = investments.filter((i) => i.status === 'CONFIRMED');
  const raised = confirmed.reduce((s, i) => s + i.amount, 0);
  const foundingRaised = confirmed.filter((i) => i.shares >= 10).reduce((s, i) => s + i.amount, 0);
  return {
    totalRaised: raised,
    percentageOfTarget: Math.min(100, (raised / settings.TARGET_AMOUNT) * 100),
    sharesSubscribed: confirmed.reduce((s, i) => s + i.shares, 0),
    foundingPhaseProgress: Math.min(100, (foundingRaised / settings.FOUNDING_AMOUNT) * 100),
    foundingRaised,
    entrepreneurSlotsFilled: confirmed.filter((i) => i.isEntrepreneur).length,
    settings: { ...settings },
  };
}

export function demoListInvestmentsPage(input: { page: number; pageSize: number; status?: string; category?: string; search?: string }) {
  const q = (input.search ?? '').toLowerCase();
  const filtered = investments.filter((i) => {
    if (input.status && i.status !== input.status) return false;
    if (input.category && i.category !== input.category) return false;
    if (q) {
      const inv = investorById(i.investorId);
      const haystack = `${inv?.name ?? ''} ${i.uid} ${i.code}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  const sorted = [...filtered].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const start = (input.page - 1) * input.pageSize;
  const items = sorted.slice(start, start + input.pageSize).map((i) => {
    const inv = investorById(i.investorId);
    return {
      id: i.id,
      uid: i.uid,
      code: i.code,
      category: i.category,
      shares: i.shares,
      amount: i.amount,
      incentiveAmount: i.incentiveAmount,
      status: i.status,
      depositDate: i.depositDate,
      depositMethod: i.depositMethod,
      investorId: i.investorId,
      investorName: inv?.name ?? '—',
      investorPhone: inv?.phone ?? '—',
      paymentPlan: i.paymentPlan ?? ('FULL' as const),
      kistis: schedules
        .filter((s) => s.investmentId === i.id)
        .sort((a, b) => a.installmentNo - b.installmentNo)
        .map(({ installmentNo, dueDate, amount, status }) => ({ installmentNo, dueDate, amount, status })),
    };
  });
  return { items, page: input.page, pageSize: input.pageSize, total: filtered.length, totalPages: Math.ceil(filtered.length / input.pageSize) || 1 };
}

export function demoGetReceiptData(investmentId: string, installmentNo?: number) {
  const i = investmentById(investmentId);
  if (!i) return null;
  const inv = investorById(i.investorId);
  if (!inv) return null;

  // Per-kisti receipt: only paid installments have a receipt row.
  if (installmentNo != null) {
    const schedule = schedules.find((s) => s.investmentId === i.id && s.installmentNo === installmentNo);
    if (!schedule || schedule.status !== 'PAID') return null;
    const paidToDate = schedules.filter((s) => s.investmentId === i.id && s.status === 'PAID').reduce((sum, s) => sum + s.amount, 0);
    return {
      uid: i.uid,
      code: i.code,
      investorName: inv.name,
      investorPhone: inv.phone,
      nationalIdNumber: inv.nationalIdNumber,
      category: i.category,
      shares: i.shares,
      sharePrice: i.sharePrice,
      amount: schedule.amount,
      isEntrepreneur: i.isEntrepreneur,
      incentiveAmount: i.incentiveAmount,
      depositMethod: i.depositMethod,
      depositRef: i.depositRef,
      depositDate: i.depositDate,
      status: i.status,
      issuedAt: i.createdAt,
      paymentPlan: 'INSTALLMENT' as const,
      installmentNo: schedule.installmentNo,
      kistiRef: `${i.uid}-K${schedule.installmentNo}`,
      totalAmount: i.shares * i.sharePrice,
      paidToDate,
    };
  }

  return {
    uid: i.uid,
    code: i.code,
    investorName: inv.name,
    investorPhone: inv.phone,
    nationalIdNumber: inv.nationalIdNumber,
    category: i.category,
    shares: i.shares,
    sharePrice: i.sharePrice,
    amount: i.amount,
    isEntrepreneur: i.isEntrepreneur,
    incentiveAmount: i.incentiveAmount,
    depositMethod: i.depositMethod,
    depositRef: i.depositRef,
    depositDate: i.depositDate,
    status: i.status,
    issuedAt: i.createdAt,
    // Payment-plan context: kisti receipts show installment + running total.
    paymentPlan: i.paymentPlan ?? ('FULL' as const),
    ...(i.paymentPlan === 'INSTALLMENT'
      ? (() => {
          const sched = schedules.filter((s) => s.investmentId === i.id).sort((a, b) => a.installmentNo - b.installmentNo);
          const paidCount = sched.filter((s) => s.status === 'PAID').length;
          const lastPaid = [...sched].reverse().find((s) => s.status === 'PAID');
          const paidToDate = sched.filter((s) => s.status === 'PAID').reduce((sum, s) => sum + s.amount, 0);
          return lastPaid
            ? { installmentNo: lastPaid.installmentNo, kistiRef: `${i.uid}-K${lastPaid.installmentNo}`, totalAmount: i.shares * i.sharePrice, paidToDate }
            : { totalAmount: i.shares * i.sharePrice, paidToDate, installmentNo: paidCount || undefined, kistiRef: undefined };
        })()
      : {}),
  };
}

// Certificates tab rows: every investment for one investor with plan/paid/cert state.
export function demoListCertificatesForInvestor(investorId: string) {
  return investments
    .filter((i) => i.investorId === investorId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((i) => ({
      id: i.id,
      uid: i.uid,
      category: i.category,
      shares: i.shares,
      amount: i.amount,
      paymentPlan: i.paymentPlan ?? ('FULL' as const),
      fullyPaidAt: i.fullyPaidAt ?? null,
      certificateIssuedAt: i.certificateIssuedAt ?? null,
    }));
}

// Certificate detail (only fully-paid investments qualify).
export function demoGetCertificate(investmentId: string) {
  const i = investmentById(investmentId);
  if (!i || !i.fullyPaidAt) return null;
  return {
    id: i.id,
    uid: i.uid,
    code: i.code,
    category: i.category,
    shares: i.shares,
    sharePrice: i.sharePrice,
    amount: i.amount,
    fullyPaidAt: i.fullyPaidAt,
    issuedAt: i.certificateIssuedAt ?? i.fullyPaidAt,
  };
}

export function demoListPaymentsForInvestment(investmentId: string) {  return demoTransactions
    .filter((t) => t.investmentId === investmentId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((t) => ({
      id: t.id,
      amount: t.amount,
      type: t.type,
      depositMethod: t.depositMethod,
      depositDate: t.depositDate,
      note: t.note,
      createdAt: t.createdAt,
      recordedByName: DEMO_STAFF.find((s) => s.id === t.recordedByStaffId)?.name ?? null,
    }));
}

export function demoVerifyLookup(code?: string, uid?: string) {
  const i = code ? investments.find((x) => x.code === code) : investments.find((x) => x.uid === uid);
  if (!i) return null;
  const inv = investorById(i.investorId);
  return {
    uid: i.uid,
    code: i.code,
    investorName: inv?.name ?? '—',
    shares: i.shares,
    amount: i.amount,
    category: i.category,
    status: i.status,
    depositDate: i.depositDate,
  };
}

export function demoListLeads() {
  return [...leads].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((l) => ({ ...l }));
}

export function demoCountNewLeads(): number {
  return leads.filter((l) => l.status === 'NEW').length;
}

/* ── Mutations (in-memory only; a restart resets the demo story) ── */

export function demoConfirmInvestment(investmentId: string): boolean {
  const i = investmentById(investmentId);
  if (!i || i.status === 'CONFIRMED') return false;
  investments = investments.map((x) => (x.id === investmentId ? { ...x, status: 'CONFIRMED' as const, confirmedAt: new Date() } : x));
  return true;
}

export type DemoCreateRequestInput = {
  investorId: string;
  kind: 'SHARE_PURCHASE' | 'PAYMENT';
  shares?: number;
  entrepreneurRequested?: boolean;
  targetInvestmentId?: string;
  installmentNo?: number | null;
  amount?: number;
  depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING';
  depositRef?: string | null;
  depositDate: Date;
  note?: string | null;
};

/** Mirrors lib/requests.ts rules: 3-open-request cap, entrepreneur ≥10 shares,
    payment target must exist and belong to the investor. Returns the new
    request id, or a string tag for each rule violation. */
export function demoCreateRequest(input: DemoCreateRequestInput): string {
  const openCount = requests.filter((r) => r.investorId === input.investorId && r.status === 'SUBMITTED').length;
  if (openCount >= 3) return 'cap';

  if (input.kind === 'SHARE_PURCHASE') {
    const shares = input.shares ?? 0;
    if (input.entrepreneurRequested && shares < 10) return 'entrepreneurMin';
  } else {
    const target = investments.find((i) => i.id === input.targetInvestmentId);
    if (!target || target.investorId !== input.investorId) return 'target';
    // One open claim per kisti — a kisti already claimed or already paid rejects.
    if (input.installmentNo != null) {
      const alreadyClaimed = requests.some(
        (r) => r.status === 'SUBMITTED' && r.targetInvestmentId === input.targetInvestmentId && r.installmentNo === input.installmentNo,
      );
      const alreadyPaid = schedules.some(
        (s) => s.investmentId === input.targetInvestmentId && s.installmentNo === input.installmentNo && s.status === 'PAID',
      );
      if (alreadyClaimed || alreadyPaid) return 'kistiClaimed';
    }
  }

  const id = `demo-req-${Date.now()}`;
  const now = new Date();
  requests = [
    {
      id,
      investorId: input.investorId,
      kind: input.kind,
      targetInvestmentId: input.targetInvestmentId ?? null,
      installmentNo: input.installmentNo ?? null,
      shares: input.shares ?? 0,
      entrepreneurRequested: input.entrepreneurRequested ?? false,
      sharePrice: DEMO_SETTINGS.SHARE_PRICE,
      incentivePerShare: DEMO_SETTINGS.INCENTIVE_PER_SHARE,
      amount: input.kind === 'SHARE_PURCHASE' ? (input.shares ?? 0) * DEMO_SETTINGS.SHARE_PRICE : (input.amount ?? 0),
      depositMethod: input.depositMethod,
      depositRef: input.depositRef ?? null,
      depositDate: input.depositDate,
      note: input.note ?? null,
      status: 'SUBMITTED',
      reviewedByStaffId: null,
      reviewedAt: null,
      reviewNote: null,
      investmentId: null,
      createdAt: now,
      updatedAt: now,
    },
    ...requests,
  ];
  return id;
}

export function demoResolveRequest(id: string, decision: 'APPROVED' | 'REJECTED', reviewNote: string | null): boolean {
  const r = requests.find((x) => x.id === id);
  if (!r || r.status !== 'SUBMITTED') return false;
  requests = requests.map((x) =>
    x.id === id
      ? { ...x, status: decision, reviewedByStaffId: 'demo-staff-admin', reviewedAt: new Date(), reviewNote, updatedAt: new Date() }
      : x,
  );

  // PAYMENT approval drives the ledger: mark the kisti PAID, credit the
  // investment amount, append the transaction row, and close the plan when
  // the last kisti clears (fullyPaidAt + certificate).
  if (decision === 'APPROVED' && r.kind === 'PAYMENT' && r.targetInvestmentId) {
    const investmentId = r.targetInvestmentId;
    if (r.installmentNo != null) {
      schedules = schedules.map((s) =>
        s.investmentId === investmentId && s.installmentNo === r.installmentNo ? { ...s, status: 'PAID' as const } : s,
      );
    }
    const allPaid = schedules.filter((s) => s.investmentId === investmentId).every((s) => s.status === 'PAID');
    investments = investments.map((inv) =>
      inv.id === investmentId
        ? {
            ...inv,
            amount: inv.amount + r.amount,
            fullyPaidAt: allPaid ? new Date() : inv.fullyPaidAt ?? null,
            certificateIssuedAt: allPaid ? new Date() : inv.certificateIssuedAt ?? null,
            updatedAt: new Date(),
          }
        : inv,
    );
    demoTransactions.push({
      id: `demo-tx-${Date.now()}`,
      investmentId,
      amount: r.amount,
      type: 'DEPOSIT' as const,
      depositMethod: r.depositMethod,
      depositDate: r.depositDate,
      note: r.note ?? 'Payment approved in demo',
      recordedByStaffId: 'demo-staff-admin',
      createdAt: new Date(),
    });
  }

  // SHARE_PURCHASE approval: create the investment (mirrors lib/requests.ts).
  if (decision === 'APPROVED' && r.kind === 'SHARE_PURCHASE') {
    const sharePrice = DEMO_SETTINGS.SHARE_PRICE;
    const incentivePerShare = DEMO_SETTINGS.INCENTIVE_PER_SHARE;
    const shares = r.shares;
    const category = shares >= 10 ? 'DIRECTOR' : shares >= 5 ? 'PREMIUM' : 'SHAREHOLDER';
    const incentiveAmount = r.entrepreneurRequested ? shares * incentivePerShare : 0;
    const uid = `NEO-${nextUidSeq++}`;
    const newId = `demo-inv-${nextUidSeq}`;
    const now = new Date();
    investments = [
      {
        id: newId,
        investorId: r.investorId,
        uid,
        code: `NB-${demoCode()}`,
        shares,
        category,
        isEntrepreneur: r.entrepreneurRequested,
        incentiveAmount,
        sharePrice,
        incentivePerShare,
        discountPerShare: 0,
        amount: shares * sharePrice,
        paymentPlan: 'FULL' as const,
        fullyPaidAt: null,
        certificateIssuedAt: null,
        depositMethod: r.depositMethod,
        depositRef: r.depositRef,
        depositDate: r.depositDate,
        status: 'CONFIRMED' as const,
        confirmedAt: now,
        notes: r.note ?? 'Approved in demo',
        recordedByStaffId: 'demo-staff-admin',
        createdAt: now,
        updatedAt: now,
      },
      ...investments,
    ];
    requests = requests.map((x) => (x.id === id ? { ...x, investmentId: newId } : x));
  }
  return true;
}

export function demoMarkLeadContacted(leadId: string): boolean {
  if (!leads.find((l) => l.id === leadId)) return false;
  leads = leads.map((l) => (l.id === leadId ? { ...l, status: 'CONTACTED' as const, contactedAt: new Date(), contactedByStaffId: 'demo-staff-admin', updatedAt: new Date() } : l));
  return true;
}

export function demoCreateLead(input: { name: string; phone: string; email?: string | null; message?: string | null }): { ok: true; lead: { id: string; ref: string } } | { ok: false; duplicateOf: string } {
  const recent = leads.find((l) => l.phone === input.phone && Date.now() - l.createdAt.getTime() < 7 * 24 * 60 * 60 * 1000);
  if (recent) return { ok: false, duplicateOf: recent.createdAt.toISOString() };
  const ref = `NB-LEAD-${Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[O0I1]/g, 'X')}`;
  const lead: DemoLead = {
    id: `demo-lead-${Date.now()}`,
    ref,
    name: input.name,
    phone: input.phone,
    email: input.email ?? null,
    message: input.message ?? null,
    status: 'NEW',
    contactedAt: null,
    contactedByStaffId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  leads = [...leads, lead];
  return { ok: true, lead: { id: lead.id, ref: lead.ref } };
}

export function demoUpdateInvestorProfile(investorId: string, data: { name: string; phone: string; nationalIdNumber: string | null; address: string | null; tin: string | null }): boolean {
  // Reject a phone already used by a different demo investor (mirrors the Prisma
  // @unique constraint the action enforces on the real DB).
  if (investors.some((i) => i.id !== investorId && i.phone === data.phone)) return false;
  const idx = investors.findIndex((i) => i.id === investorId);
  if (idx === -1) return false;
  investors[idx] = {
    ...investors[idx],
    name: data.name,
    phone: data.phone,
    nationalIdNumber: data.nationalIdNumber ?? investors[idx].nationalIdNumber,
    address: data.address ?? null,
    tin: data.tin ?? null,
    updatedAt: new Date(),
  };
  return true;
}

/* ── Demo auth identities (cookie session, no Supabase) ── */

export type DemoInvestorDetail = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  nationalIdNumber: string | null;
  tin: string | null;
  address: string | null;
  approvalStatus: 'PENDING' | 'APPROVED';
  createdAt: Date;
  investments: ReturnType<typeof demoListInvestmentsForInvestor>;
  requests: ReturnType<typeof demoListRequestsForInvestor>;
};

export function demoGetInvestorDetail(id: string): DemoInvestorDetail | null {
  const inv = investors.find((i) => i.id === id);
  if (!inv) return null;
  return {
    id: inv.id,
    name: inv.name,
    phone: inv.phone,
    email: inv.email,
    nationalIdNumber: inv.nationalIdNumber,
    address: inv.address ?? null,
    tin: inv.tin ?? null,
    approvalStatus: inv.approvalStatus,
    createdAt: inv.createdAt,
    investments: demoListInvestmentsForInvestor(inv.id).map((i) => {
      const inv2 = investmentById(i.id);
      return {
        ...i,
        depositDate: inv2?.depositDate ?? new Date(),
        depositMethod: inv2?.depositMethod ?? ('BANK_DEPOSIT' as const),
        certificateRef: inv2?.certificateIssuedAt ? `${i.uid}-CERT` : null,
        kistis: schedules
          .filter((s) => s.investmentId === i.id)
          .sort((a, b) => a.installmentNo - b.installmentNo)
          .map(({ installmentNo, dueDate, amount, status }) => ({ installmentNo, dueDate, amount, status })),
      };
    }),
    requests: demoListRequestsForInvestor(inv.id),
  };
}


export function demoInvestorForAuthUser(authUserId: string) {
  // Reads the mutable array so profile edits (demoUpdateInvestorProfile) show up on reload.
  const inv = investors.find((i) => i.authUserId === authUserId);
  if (!inv) return null;
  return {
    id: inv.id,
    authUserId: inv.authUserId!,
    phone: inv.phone,
    name: inv.name,
    email: inv.email,
    nationalIdNumber: inv.nationalIdNumber,
    tin: inv.tin ?? null,
    address: inv.address ?? null,
    approvalStatus: inv.approvalStatus,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  };
}

export function demoStaffForAuthUser(authUserId: string) {
  const s = DEMO_STAFF.find((x) => x.authUserId === authUserId);
  if (!s) return null;
  return { ...s };
}

export function demoAssertOwnsInvestment(investorId: string, investmentId: string): boolean {
  const i = investmentById(investmentId);
  return Boolean(i && i.investorId === investorId);
}

export function demoInvestorIdForPhone(phone: string): string | null {
  return DEMO_INVESTORS.find((i) => i.phone === phone)?.id ?? null;
}

/* ── Full-demo capabilities: registration, login, settings, payments ── */

export function demoGetSettings(): Record<string, number> {
  return { ...settings };
}

export function demoUpdateSettings(values: Partial<Record<string, number>>): void {
  settings = { ...settings };
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === 'number') settings[k] = v;
  }
}

/** Staff registers a new deposit (admin register form): creates or reuses the
    investor by phone, mints NEO-####/NB-XXXXXX, computes category + incentive
    with the same rules as lib/investments.ts. */
export function demoRegisterInvestment(input: {
  name: string;
  phone: string;
  shares: number;
  isEntrepreneur: boolean;
  depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING';
  depositDate: Date;
  email?: string | null;
  nationalIdNumber?: string | null;
  depositRef?: string | null;
  notes?: string | null;
}): { uid: string; code: string; id: string } {
  const sharePrice = settings.SHARE_PRICE;
  const incentivePerShare = settings.INCENTIVE_PER_SHARE;
  const category = input.shares >= 10 ? 'DIRECTOR' : input.shares >= 5 ? 'PREMIUM' : 'SHAREHOLDER';
  const incentiveAmount = input.isEntrepreneur ? input.shares * incentivePerShare : 0;

  let investor = investors.find((i) => i.phone === input.phone);
  if (!investor) {
    const created = {
      id: `demo-investor-${Date.now()}`,
      authUserId: null,
      phone: input.phone,
      name: input.name,
      email: input.email ?? null,
      nationalIdNumber: input.nationalIdNumber ?? null,
      approvalStatus: 'APPROVED' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    investors = [...investors, created];
    investor = created;
  }

  const uid = `NEO-${nextUidSeq++}`;
  const code = `NB-${demoCode()}`;
  const id = `demo-inv-${nextUidSeq}`;
  const now = new Date();
  investments = [
    {
      id,
      investorId: investor.id,
      uid,
      code,
      shares: input.shares,
      category,
      isEntrepreneur: input.isEntrepreneur,
      incentiveAmount,
      sharePrice,
      incentivePerShare,
      amount: input.shares * sharePrice,
      depositMethod: input.depositMethod,
      depositRef: input.depositRef ?? null,
      depositDate: input.depositDate,
      status: 'PENDING',
      confirmedAt: null,
      notes: input.notes ?? 'Registered in demo',
      recordedByStaffId: 'demo-staff-admin',
      createdAt: now,
      updatedAt: now,
    },
    ...investments,
  ];
  return { uid, code, id };
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function demoCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

/** Staff records a phone-reported payment: a DEPOSIT transaction against the
    investment (visible on the admin receipts page payment history). */
export function demoRecordPayment(investmentId: string, input: {
  amount: number;
  depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING';
  depositRef?: string | null;
  depositDate: Date;
  note?: string | null;
}): string {
  const transactionId = `demo-tx-${Date.now()}`;
  const tx = {
    id: transactionId,
    investmentId,
    amount: input.amount,
    type: 'DEPOSIT' as const,
    depositMethod: input.depositMethod,
    depositDate: input.depositDate,
    note: input.note ?? 'Recorded in demo',
    recordedByStaffId: 'demo-staff-admin',
    createdAt: new Date(),
  };
  demoTransactions.push(tx);
  return transactionId;
}

/* ── Demo phone+password auth (register → login → change password) ── */

/** Self-registration creates a demo investor with a password; returns the
    phone so the login form can sign in immediately after. */
export function demoSignUp(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
  nationalIdNumber?: string | null;
}): { ok: true } | { ok: false; error: 'duplicateEmail' | 'duplicatePhone' } {
  const email = input.email.trim().toLowerCase();
  if (investors.some((i) => i.email?.toLowerCase() === email)) return { ok: false, error: 'duplicateEmail' };
  if (input.phone && investors.some((i) => i.phone === input.phone)) return { ok: false, error: 'duplicatePhone' };
  const authUserId = `demo-auth-${Date.now()}`;
  investors = [
    ...investors,
    {
      id: `demo-investor-${Date.now()}`,
      authUserId,
      phone: input.phone,
      name: input.name,
      email: input.email.trim(),
      nationalIdNumber: input.nationalIdNumber ?? null,
      approvalStatus: 'PENDING' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  demoPasswords[authUserId] = input.password;
  return { ok: true };
}

/** Registration pre-check for the register form: is this email already
    known, and has the admin approved it? Covers seeded and self-registered
    demo accounts alike (same mutable array demoSignUp checks). */
export function demoRegistrationStatusForEmail(email: string): { registered: boolean; approved: boolean } {
  const norm = email.trim().toLowerCase();
  const investor = investors.find((i) => i.email?.toLowerCase() === norm);
  if (!investor) return { registered: false, approved: false };
  return { registered: true, approved: investor.approvalStatus === 'APPROVED' };
}

export function demoSignInWithPassword(email: string, password: string): 'investor' | 'investor-kisti' | 'admin' | null {  const norm = email.trim().toLowerCase();
  // Seeded demo identities keep their @neobee.test auth emails.
  if (norm === 'demo-admin@neobee.test' && password === demoPasswords['demo-auth-admin']) return 'admin';
  if (norm === 'demo-investor@neobee.test' && password === demoPasswords['demo-auth-investor']) return 'investor';
  // Anyone registered during this demo run signs in by their own email.
  const investor = investors.find((i) => i.email?.toLowerCase() === norm);
  if (investor?.authUserId && demoPasswords[investor.authUserId] === password) {
    if (investor.authUserId === 'demo-auth-investor-kisti') return 'investor-kisti';
    return 'investor';
  }
  return null;
}

export function demoChangePassword(currentAuthUserId: string, newPassword: string): boolean {
  if (!demoPasswords[currentAuthUserId]) return false;
  demoPasswords[currentAuthUserId] = newPassword;
  return true;
}

/** The demo OTP step: any 6-digit code verifies (no SMS in a local demo). */
export function demoVerifyOtp(): boolean {
  return true;
}

/** Profile completion links the registered details to the signed-in session. */
export function demoCompleteProfile(authUserId: string, input: {
  name: string;
  email: string;
  phone: string;
  nationalIdNumber: string;
}): boolean {
  const investor = investors.find((i) => i.authUserId === authUserId);
  if (!investor) return false;
  investors = investors.map((i) =>
    i.id === investor.id
      ? { ...i, name: input.name, email: input.email, phone: input.phone || i.phone, nationalIdNumber: input.nationalIdNumber || i.nationalIdNumber, updatedAt: new Date() }
      : i,
  );
  return true;
}

/* ── Registration approval queue (admin) ───────────────────────── */

export function demoListRegistrations() {
  return [...investors]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((i) => ({
      id: i.id,
      name: i.name,
      email: i.email,
      phone: i.phone,
      nationalIdNumber: i.nationalIdNumber,
      approvalStatus: i.approvalStatus,
      createdAt: i.createdAt,
      investmentCount: investments.filter((inv) => inv.investorId === i.id).length,
    }));
}

export function demoCountPendingRegistrations(): number {
  return investors.filter((i) => i.approvalStatus === 'PENDING').length;
}

export function demoApproveRegistration(investorId: string): boolean {
  if (!investors.find((i) => i.id === investorId)) return false;
  investors = investors.map((i) => (i.id === investorId ? { ...i, approvalStatus: 'APPROVED' as const, updatedAt: new Date() } : i));
  return true;
}
