import { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/db';
import {
  assertEntrepreneurEligible,
  calculateAmount,
  calculateIncentive,
  deriveCategory,
  ENTREPRENEUR_MIN_SHARES,
  MAX_SHARES,
  MIN_SHARES,
} from '@/lib/money';
import { getSettings } from '@/lib/settings';
import { actionVerbs, writeAuditLog } from '@/lib/audit';
import { ActorType, InvestmentRequestStatus, InvestmentStatus, DepositMethod, TransactionType, RequestKind } from '@/lib/generated/prisma/client';
import { createInvestmentRecord } from '@/lib/investments';

export type RequestMeta = { ipAddress: string | null; userAgent: string | null };

export interface SubmitInvestmentRequestInput {
  investorId: string;
  shares: number;
  entrepreneurRequested: boolean;
  depositMethod: DepositMethod;
  depositRef?: string | null;
  depositDate: Date;
  note?: string | null;
}

export interface ApproveInvestmentRequestInput {
  requestId: string;
  staffId: string;
  shares?: number;
  isEntrepreneur?: boolean;
  depositMethod?: DepositMethod;
  depositRef?: string | null;
  depositDate?: Date;
  reviewNote?: string | null;
}

export interface RejectInvestmentRequestInput {
  requestId: string;
  staffId: string;
  reviewNote: string;
}

async function countSubmittedRequestsForInvestor(
  tx: Prisma.TransactionClient,
  investorId: string,
): Promise<number> {
  return await tx.investmentRequest.count({
    where: { investorId, status: InvestmentRequestStatus.SUBMITTED },
  });
}

export async function submitInvestmentRequest(
  input: SubmitInvestmentRequestInput,
  requestMeta?: RequestMeta,
): Promise<import('@/lib/generated/prisma/client').InvestmentRequest> {
  if (input.shares < MIN_SHARES || input.shares > MAX_SHARES) {
    throw new Error(`Shares must be between ${MIN_SHARES} and ${MAX_SHARES}`);
  }
  if (input.entrepreneurRequested && input.shares < ENTREPRENEUR_MIN_SHARES) {
    throw new Error(`Entrepreneur requires at least ${ENTREPRENEUR_MIN_SHARES} shares`);
  }

  const settings = await getSettings();
  const sharePrice = settings.SHARE_PRICE;
  const incentivePerShare = settings.INCENTIVE_PER_SHARE;
  const amount = calculateAmount(input.shares, sharePrice);

  return await prisma.$transaction(async (tx) => {
    const openCount = await countSubmittedRequestsForInvestor(tx, input.investorId);
    if (openCount >= 3) {
      throw new Error('Investor already has 3 open requests');
    }

    const request = await tx.investmentRequest.create({
      data: {
        investorId: input.investorId,
        kind: RequestKind.SHARE_PURCHASE,
        shares: input.shares,
        entrepreneurRequested: input.entrepreneurRequested,
        sharePrice,
        incentivePerShare,
        amount,
        depositMethod: input.depositMethod,
        depositRef: input.depositRef ?? null,
        depositDate: input.depositDate,
        note: input.note ?? null,
        status: InvestmentRequestStatus.SUBMITTED,
      },
    });

    await writeAuditLog(
      {
        actorType: ActorType.INVESTOR,
        actorId: input.investorId,
        action: actionVerbs.requestSubmit,
        targetType: 'InvestmentRequest',
        targetId: request.id,
        ipAddress: requestMeta?.ipAddress ?? null,
        userAgent: requestMeta?.userAgent ?? null,
        metadata: { shares: input.shares, entrepreneurRequested: input.entrepreneurRequested, amount },
      },
      tx,
    );

    return request;
  });
}

function normalizeDepositRef(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export async function approveInvestmentRequest(
  input: ApproveInvestmentRequestInput,
  requestMeta?: RequestMeta,
): Promise<import('@/lib/generated/prisma/client').InvestmentRequest> {
  return await prisma.$transaction(async (tx) => {
    const request = await tx.investmentRequest.findUnique({
      where: { id: input.requestId },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    // Atomically claim the SUBMITTED→APPROVED transition.
    // Under PostgreSQL Read Committed, the row-level write lock + conditional WHERE
    // guarantees exactly one concurrent transaction can succeed.
    const claimed = await tx.investmentRequest.updateMany({
      where: { id: input.requestId, status: InvestmentRequestStatus.SUBMITTED },
      data: {
        status: InvestmentRequestStatus.APPROVED,
        reviewedByStaffId: input.staffId,
        reviewedAt: new Date(),
      },
    });

    if (claimed.count === 0) {
      throw new Error('Request is not in SUBMITTED status');
    }

    // Data from findUnique is still consistent: claim succeeded means no
    // concurrent approval mutated the row.
    const effectiveShares = input.shares ?? request.shares;
    const effectiveIsEntrepreneur = input.isEntrepreneur ?? request.entrepreneurRequested;
    const effectiveDepositMethod = input.depositMethod ?? request.depositMethod;
    const effectiveDepositRef = normalizeDepositRef(input.depositRef ?? request.depositRef);
    const effectiveDepositDate = input.depositDate ?? request.depositDate;

    assertEntrepreneurEligible(effectiveShares, effectiveIsEntrepreneur);
    const category = deriveCategory(effectiveShares);
    const incentiveAmount = calculateIncentive(effectiveShares, effectiveIsEntrepreneur, request.incentivePerShare);
    const amount = calculateAmount(effectiveShares, request.sharePrice);

    const nothingChanged =
      effectiveShares === request.shares &&
      effectiveIsEntrepreneur === request.entrepreneurRequested &&
      effectiveDepositMethod === request.depositMethod &&
      effectiveDepositRef === request.depositRef &&
      new Date(effectiveDepositDate).getTime() === new Date(request.depositDate).getTime();

    const investmentStatus = nothingChanged ? InvestmentStatus.CONFIRMED : InvestmentStatus.PENDING;
    const confirmedAt = nothingChanged ? new Date() : null;
    const confirmedByInvestorId = nothingChanged ? request.investorId : null;

    const investment = await createInvestmentRecord(tx, {
      investorId: request.investorId,
      shares: effectiveShares,
      category,
      isEntrepreneur: effectiveIsEntrepreneur,
      incentiveAmount,
      sharePrice: request.sharePrice,
      incentivePerShare: request.incentivePerShare,
      amount,
      depositMethod: effectiveDepositMethod,
      depositRef: effectiveDepositRef,
      depositDate: effectiveDepositDate,
      notes: input.reviewNote ?? null,
      recordedByStaffId: input.staffId,
      status: investmentStatus,
    });

    if (nothingChanged) {
      await tx.investment.update({
        where: { id: investment.id },
        data: { confirmedAt, confirmedByInvestorId },
      });
    }

    const updatedRequest = await tx.investmentRequest.update({
      where: { id: input.requestId },
      data: {
        investmentId: investment.id,
        reviewNote: input.reviewNote ?? null,
      },
    });

    await writeAuditLog(
      {
        actorType: ActorType.STAFF,
        actorId: input.staffId,
        action: actionVerbs.requestApprove,
        targetType: 'InvestmentRequest',
        targetId: input.requestId,
        ipAddress: requestMeta?.ipAddress ?? null,
        userAgent: requestMeta?.userAgent ?? null,
        metadata: {
          investmentId: investment.id,
          modified: !nothingChanged,
          originalShares: request.shares,
          effectiveShares,
          originalEntrepreneurRequested: request.entrepreneurRequested,
          effectiveIsEntrepreneur,
        },
      },
      tx,
    );

    return updatedRequest;
  });
}

export async function rejectInvestmentRequest(
  input: RejectInvestmentRequestInput,
  requestMeta?: RequestMeta,
): Promise<import('@/lib/generated/prisma/client').InvestmentRequest> {
  if (!input.reviewNote || input.reviewNote.trim().length === 0) {
    throw new Error('Review note is required');
  }

  return await prisma.$transaction(async (tx) => {
    const request = await tx.investmentRequest.findUnique({
      where: { id: input.requestId },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    // Atomically claim the SUBMITTED→REJECTED transition.
    // Under PostgreSQL Read Committed, the row-level write lock + conditional WHERE
    // guarantees exactly one concurrent transaction can succeed.
    const claimed = await tx.investmentRequest.updateMany({
      where: { id: input.requestId, status: InvestmentRequestStatus.SUBMITTED },
      data: {
        status: InvestmentRequestStatus.REJECTED,
        reviewedByStaffId: input.staffId,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote,
      },
    });

    if (claimed.count === 0) {
      throw new Error('Request is not in SUBMITTED status');
    }

    await writeAuditLog(
      {
        actorType: ActorType.STAFF,
        actorId: input.staffId,
        action: actionVerbs.requestReject,
        targetType: 'InvestmentRequest',
        targetId: input.requestId,
        ipAddress: requestMeta?.ipAddress ?? null,
        userAgent: requestMeta?.userAgent ?? null,
        metadata: { reviewNote: input.reviewNote },
      },
      tx,
    );

    // Re-fetch the updated row within the same transaction.
    return tx.investmentRequest.findUniqueOrThrow({ where: { id: input.requestId } });
  });
}

/* ── Payment-done requests (PAYMENT kind) ───────────────────────
   The investor reports an offline payment (installment or share
   payment) toward one of their EXISTING investments. Approval records
   a DEPOSIT ledger Transaction — it never creates an Investment, and
   Investment.amount is deliberately left untouched: nothing in the
   codebase recomputes principal today, and inventing that semantics
   silently would rewrite financial history. */

export interface SubmitPaymentRequestInput {
  investorId: string;
  targetInvestmentId: string;
  amount: number;
  depositMethod: DepositMethod;
  depositRef?: string | null;
  depositDate: Date;
  note?: string | null;
}

export async function submitPaymentRequest(
  input: SubmitPaymentRequestInput,
  requestMeta?: RequestMeta,
): Promise<import('@/lib/generated/prisma/client').InvestmentRequest> {
  if (input.amount < 1) {
    throw new Error('Amount must be at least ৳1');
  }

  return await prisma.$transaction(async (tx) => {
    const openCount = await countSubmittedRequestsForInvestor(tx, input.investorId);
    if (openCount >= 3) {
      throw new Error('Investor already has 3 open requests');
    }

    // Ownership boundary: the target investment must belong to the requester.
    const target = await tx.investment.findFirst({
      where: { id: input.targetInvestmentId, investorId: input.investorId },
      select: { id: true },
    });
    if (!target) {
      throw new Error('Target investment not found for this investor');
    }

    const settings = await getSettings();
    const request = await tx.investmentRequest.create({
      data: {
        investorId: input.investorId,
        kind: RequestKind.PAYMENT,
        targetInvestmentId: target.id,
        shares: 0,
        entrepreneurRequested: false,
        sharePrice: settings.SHARE_PRICE,
        incentivePerShare: settings.INCENTIVE_PER_SHARE,
        amount: input.amount,
        depositMethod: input.depositMethod,
        depositRef: input.depositRef ?? null,
        depositDate: input.depositDate,
        note: input.note ?? null,
        status: InvestmentRequestStatus.SUBMITTED,
      },
    });

    await writeAuditLog(
      {
        actorType: ActorType.INVESTOR,
        actorId: input.investorId,
        action: actionVerbs.requestSubmit,
        targetType: 'InvestmentRequest',
        targetId: request.id,
        ipAddress: requestMeta?.ipAddress ?? null,
        userAgent: requestMeta?.userAgent ?? null,
        metadata: { kind: 'PAYMENT', targetInvestmentId: target.id, amount: input.amount },
      },
      tx,
    );

    return request;
  });
}

export interface ApprovePaymentRequestInput {
  requestId: string;
  staffId: string;
  reviewNote?: string | null;
}

export async function approvePaymentRequest(
  input: ApprovePaymentRequestInput,
  requestMeta?: RequestMeta,
): Promise<import('@/lib/generated/prisma/client').InvestmentRequest> {
  return await prisma.$transaction(async (tx) => {
    const request = await tx.investmentRequest.findUnique({
      where: { id: input.requestId },
    });

    if (!request) {
      throw new Error('Request not found');
    }
    if (request.kind !== RequestKind.PAYMENT) {
      throw new Error('Not a payment request');
    }

    const claimed = await tx.investmentRequest.updateMany({
      where: { id: input.requestId, status: InvestmentRequestStatus.SUBMITTED },
      data: {
        status: InvestmentRequestStatus.APPROVED,
        reviewedByStaffId: input.staffId,
        reviewedAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      throw new Error('Request is not in SUBMITTED status');
    }

    if (!request.targetInvestmentId) {
      throw new Error('Payment request has no target investment');
    }

    const transaction = await tx.transaction.create({
      data: {
        investmentId: request.targetInvestmentId,
        amount: request.amount,
        type: TransactionType.DEPOSIT,
        depositMethod: request.depositMethod,
        depositDate: request.depositDate,
        recordedByStaffId: input.staffId,
        note: input.reviewNote ?? request.note ?? null,
      },
    });

    const updatedRequest = await tx.investmentRequest.update({
      where: { id: input.requestId },
      data: { reviewNote: input.reviewNote ?? null },
    });

    await writeAuditLog(
      {
        actorType: ActorType.STAFF,
        actorId: input.staffId,
        action: actionVerbs.requestApprove,
        targetType: 'InvestmentRequest',
        targetId: input.requestId,
        ipAddress: requestMeta?.ipAddress ?? null,
        userAgent: requestMeta?.userAgent ?? null,
        metadata: {
          kind: 'PAYMENT',
          transactionId: transaction.id,
          targetInvestmentId: request.targetInvestmentId,
          amount: request.amount,
        },
      },
      tx,
    );

    return updatedRequest;
  });
}

/* ── Staff-recorded payment (investor called the desk) ──────────
   Same ledger outcome as approving a payment request, initiated by
   staff directly on an investment's record. */

export interface RecordInvestmentPaymentInput {
  investmentId: string;
  staffId: string;
  amount: number;
  depositMethod: DepositMethod;
  depositRef?: string | null;
  depositDate: Date;
  note?: string | null;
}

export async function recordInvestmentPayment(
  input: RecordInvestmentPaymentInput,
  requestMeta?: RequestMeta,
): Promise<string> {
  if (input.amount < 1) {
    throw new Error('Amount must be at least ৳1');
  }

  return await prisma.$transaction(async (tx) => {
    const investment = await tx.investment.findUnique({
      where: { id: input.investmentId },
      select: { id: true },
    });
    if (!investment) {
      throw new Error('Investment not found');
    }

    const transaction = await tx.transaction.create({
      data: {
        investmentId: input.investmentId,
        amount: input.amount,
        type: TransactionType.DEPOSIT,
        depositMethod: input.depositMethod,
        depositDate: input.depositDate,
        recordedByStaffId: input.staffId,
        note: input.note ?? null,
      },
    });

    await writeAuditLog(
      {
        actorType: ActorType.STAFF,
        actorId: input.staffId,
        action: actionVerbs.paymentRecord,
        targetType: 'Investment',
        targetId: input.investmentId,
        ipAddress: requestMeta?.ipAddress ?? null,
        userAgent: requestMeta?.userAgent ?? null,
        metadata: { transactionId: transaction.id, amount: input.amount, method: input.depositMethod },
      },
      tx,
    );

    return transaction.id;
  });
}