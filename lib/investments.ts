import { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/db';
import {
  assertEntrepreneurEligible,
  calculateAmount,
  calculateIncentive,
  deriveCategory,
  formatUid,
  generateVerificationCode,
  INSTALLMENT_DEADLINES,
  type InvestmentCategory,
  type PaymentPlanValue,
} from '@/lib/money';
import { getSettings } from '@/lib/settings';
import { actionVerbs, writeAuditLog } from '@/lib/audit';
import { ActorType, InvestmentStatus, InstallmentStatus, TransactionType, DepositMethod } from '@/lib/generated/prisma/client';
import type { RegisterInvestmentInput } from '@/lib/validation';

export type RequestMeta = { ipAddress: string | null; userAgent: string | null };

interface CreateInvestmentRecordParams {
  investorId: string;
  shares: number;
  category: InvestmentCategory;
  isEntrepreneur: boolean;
  incentiveAmount: number;
  sharePrice: number;
  incentivePerShare: number;
  discountPerShare: number;
  paymentPlan: PaymentPlanValue;
  slipFileKey: string | null;
  amount: number; // the initial ledger amount: FULL total or kisti 1
  totalAmount: number; // the plan's full face value: shares × sharePrice
  depositMethod: DepositMethod;
  depositRef: string | null;
  depositDate: Date;
  notes: string | null;
  recordedByStaffId: string;
  status: InvestmentStatus;
}

function isCodeConflict(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function uniqueConstraintTargetsCode(error: Prisma.PrismaClientKnownRequestError): boolean {
  const target = error.meta?.target;
  return Array.isArray(target) && target.includes('code');
}

async function nextInvestmentUid(client: Prisma.TransactionClient): Promise<{ uidSequence: number; uid: string }> {
  const rows = await client.$queryRaw<Array<{ nextval: bigint }>>`SELECT nextval('investment_uid_seq') AS nextval`;
  const sequenceBigInt = rows[0]?.nextval ?? BigInt(0);
  const sequence = Number(sequenceBigInt);
  if (!Number.isSafeInteger(sequence) || sequence <= 0) {
    throw new RangeError('investment_uid_seq returned an unsafe value');
  }
  return { uidSequence: sequence, uid: formatUid(sequence) };
}

export async function createInvestmentRecord(
  tx: Prisma.TransactionClient,
  params: CreateInvestmentRecordParams,
): Promise<import('@/lib/generated/prisma/client').Investment> {
  const { uidSequence, uid } = await nextInvestmentUid(tx);
  const code = generateVerificationCode();

  // FULL plans are paid in one shot, so fullyPaidAt is set immediately.
  // INSTALLMENT plans complete when the last kisti's payment is approved.
  const fullyPaidAt = params.paymentPlan === 'FULL' ? new Date() : null;

  const investment = await tx.investment.create({
    data: {
      investorId: params.investorId,
      uid,
      uidSequence,
      code,
      shares: params.shares,
      category: params.category,
      isEntrepreneur: params.isEntrepreneur,
      incentiveAmount: params.incentiveAmount,
      sharePrice: params.sharePrice,
      incentivePerShare: params.incentivePerShare,
      discountPerShare: params.discountPerShare,
      amount: params.amount,
      paymentPlan: params.paymentPlan,
      slipFileKey: params.slipFileKey,
      fullyPaidAt,
      depositMethod: params.depositMethod,
      depositRef: params.depositRef,
      depositDate: params.depositDate,
      notes: params.notes,
      status: params.status,
      recordedByStaffId: params.recordedByStaffId,
    },
  });

  await tx.transaction.create({
    data: {
      investmentId: investment.id,
      amount: params.amount,
      type: TransactionType.DEPOSIT,
      recordedByStaffId: params.recordedByStaffId,
      note: params.paymentPlan === 'FULL' ? 'Initial deposit (full payment)' : 'Initial deposit (kisti 1)',
    },
  });

  if (params.paymentPlan === 'INSTALLMENT') {
    if (INSTALLMENT_DEADLINES.length !== 4) {
      throw new RangeError('INSTALLMENT_DEADLINES must have 4 entries');
    }
    // Kisti 1 is paid at registration; kistis 2–4 get SCHEDULED rows with the fixed deadlines.
    await tx.installmentSchedule.create({
      data: {
        investmentId: investment.id,
        installmentNo: 1,
        dueDate: new Date(INSTALLMENT_DEADLINES[0]),
        amount: params.amount,
        status: InstallmentStatus.PAID,
        note: 'Paid at registration',
      },
    });
    const remainingPerKisti = Math.round((params.totalAmount - params.amount) / 3);
    for (let kisti = 2; kisti <= 4; kisti += 1) {
      await tx.installmentSchedule.create({
        data: {
          investmentId: investment.id,
          installmentNo: kisti,
          dueDate: new Date(INSTALLMENT_DEADLINES[kisti - 1]),
          amount: kisti === 4
            ? params.totalAmount - params.amount - remainingPerKisti * 2 // remainder lands on the last kisti
            : remainingPerKisti,
          status: InstallmentStatus.SCHEDULED,
        },
      });
    }
  }

  // A certificate exists only for fully-paid investments (FULL plans at creation).
  if (fullyPaidAt) {
    await tx.certificate.create({
      data: { investmentId: investment.id },
    });
  }

  const ledgerRows = await tx.transaction.findMany({
    where: {
      investmentId: investment.id,
      type: { in: [TransactionType.DEPOSIT, TransactionType.REFUND, TransactionType.CORRECTION] },
    },
    select: { amount: true },
  });
  const ledger = ledgerRows.reduce((sum, row) => sum + row.amount, 0);
  await tx.investment.update({ where: { id: investment.id }, data: { amount: ledger } });

  return await tx.investment.findUniqueOrThrow({ where: { id: investment.id } });
}

export async function registerInvestment(
  input: RegisterInvestmentInput,
  staffId: string,
  requestMeta: RequestMeta,
): Promise<import('@/lib/generated/prisma/client').Investment> {
  const settings = await getSettings();
  const sharePrice = settings.SHARE_PRICE;
  const incentivePerShare = settings.INCENTIVE_PER_SHARE;

  assertEntrepreneurEligible(input.shares, input.isEntrepreneur);
  const category: InvestmentCategory = deriveCategory(input.shares);
  const amountSnapshot = calculateAmount(input.shares, sharePrice);
  const incentiveAmount = calculateIncentive(input.shares, input.isEntrepreneur, incentivePerShare);

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const investor = await tx.investor.upsert({
          where: { phone: input.phone },
          create: {
            phone: input.phone,
            name: input.name,
            email: input.email ?? null,
            nationalIdNumber: input.nationalIdNumber ?? null,
            authUserId: null,
          },
          update: {
            name: input.name,
            email: input.email ?? null,
            nationalIdNumber: input.nationalIdNumber ?? null,
          },
        });

        const investment = await createInvestmentRecord(tx, {
          investorId: investor.id,
          shares: input.shares,
          category,
          isEntrepreneur: input.isEntrepreneur,
          incentiveAmount,
          sharePrice,
          incentivePerShare,
          // Walk-in desk registration: staff collected the full amount in hand.
          discountPerShare: 0,
          paymentPlan: 'FULL',
          slipFileKey: null,
          amount: amountSnapshot,
          totalAmount: amountSnapshot,
          depositMethod: input.depositMethod,
          depositRef: input.depositRef ?? null,
          depositDate: input.depositDate,
          notes: input.notes ?? null,
          recordedByStaffId: staffId,
          status: InvestmentStatus.PENDING,
        });

        await writeAuditLog(
          {
            actorType: ActorType.STAFF,
            actorId: staffId,
            action: actionVerbs.investmentRegister,
            targetType: 'Investment',
            targetId: investment.id,
            ipAddress: requestMeta.ipAddress,
            userAgent: requestMeta.userAgent,
            metadata: { uid: investment.uid, code: investment.code, investorId: investor.id, amount: investment.amount },
          },
          tx,
        );

        return investment;
      });
    } catch (error) {
      if (isCodeConflict(error) && uniqueConstraintTargetsCode(error)) {
        if (attempt < 5) continue;
        throw new Error('Failed to generate a unique verification code after 5 attempts');
      }
      throw error;
    }
  }
  throw new Error('Failed to register investment');
}

export async function confirmInvestment(
  investmentId: string,
  investorId: string,
  requestMeta: RequestMeta,
): Promise<import('@/lib/generated/prisma/client').Investment> {
  return await prisma.$transaction(async (tx) => {
    const investment = await tx.investment.findUnique({ where: { id: investmentId } });
    if (!investment || investment.investorId !== investorId) {
      throw new Error('Forbidden');
    }
    if (investment.status === InvestmentStatus.CONFIRMED) {
      return investment;
    }

    const confirmed = await tx.investment.update({
      where: { id: investmentId },
      data: {
        status: InvestmentStatus.CONFIRMED,
        confirmedAt: new Date(),
        confirmedByInvestorId: investorId,
      },
    });

    await writeAuditLog(
      {
        actorType: ActorType.INVESTOR,
        actorId: investorId,
        action: actionVerbs.investmentConfirm,
        targetType: 'Investment',
        targetId: investmentId,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      },
      tx,
    );

    return confirmed;
  });
}