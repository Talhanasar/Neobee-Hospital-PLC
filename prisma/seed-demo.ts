// Demo seed — creates the demo auth users + DB rows used by the one-click
// demo-login affordance: 1 admin, 2 investors (instant-pay + kisti-in-progress),
// 1 pending share request, and interest leads. Idempotent: safe to re-run.
//
// Self-sufficient: upserts every Setting, so it can run alone on a fresh
// database (`npx tsx prisma/seed-demo.ts`) as well as after prisma/seed.ts.
//
// Respects the same SEED_ALLOW production gate as seed.ts.

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../lib/generated/prisma/client';
import type { TransactionClient } from '../lib/generated/prisma/internal/prismaNamespace';
// Relative import is deliberate here because tsx does not resolve the @/ alias in this standalone script.
import { DEFAULT_SETTINGS, calculateAmount, deriveCategory } from '../lib/money';
import { DEMO_INVESTOR, DEMO_INVESTOR_KISTI, DEMO_ADMIN } from '../lib/demo-users';
import { hashPassword } from '../lib/auth-own/password';

const isProduction = process.env.NODE_ENV === 'production';
const allowSeed = process.env.SEED_ALLOW === 'true';

// ── Cleanup mode ─────────────────────────────────────────────────
// `npx tsx prisma/seed-demo.ts --cleanup` removes every demo-marked row
// (phones +88017900000*, UIDs NEO-90*, @neobee.test emails/staff) and the
// demo auth users. Tolerant: missing rows are fine.
if (process.argv.includes('--cleanup')) {
  void cleanup().then(() => process.exit(0));
} else {
  void main();
}

async function cleanup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    try {
      const demoInvestors = await prisma.investor.findMany({
        where: { phone: { startsWith: '+88017900000' } },
        select: { id: true },
      });
      const investorIds = demoInvestors.map((i) => i.id);
      const demoInvestments = await prisma.investment.findMany({
        where: { OR: [{ uid: { startsWith: 'NHL-S-0090' } }, { uid: { startsWith: 'NEO-90' } }, { investorId: { in: investorIds } }] },
        select: { id: true },
      });
      const investmentIds = demoInvestments.map((i) => i.id);
      const demoGroups = await prisma.paymentGroup.findMany({ where: { investorId: { in: investorIds } }, select: { id: true } });
      const groupIds = demoGroups.map((g) => g.id);
      await prisma.installmentSchedule.deleteMany({
        where: { OR: [{ paymentGroupId: { in: groupIds } }, { investmentId: { in: investmentIds } }] },
      });
      const deletedCertificates = await prisma.certificate.deleteMany({ where: { investmentId: { in: investmentIds } } });
      const deletedTransactions = await prisma.transaction.deleteMany({ where: { investmentId: { in: investmentIds } } });
      const deletedRequests = await prisma.investmentRequest.deleteMany({
        where: { OR: [{ investorId: { in: investorIds } }, { targetInvestmentId: { in: investmentIds } }] },
      });
      const deletedInvestments = await prisma.investment.deleteMany({ where: { id: { in: investmentIds } } });
      const deletedGroups = await prisma.paymentGroup.deleteMany({ where: { id: { in: groupIds } } });
      const deletedInvestors = await prisma.investor.deleteMany({ where: { id: { in: investorIds } } });
      const deletedStaff = await prisma.staff.deleteMany({ where: { email: 'demo-admin@neobee.test' } });
      const deletedLeads = await prisma.lead.deleteMany({ where: { ref: { startsWith: 'NB-LEAD-' } } });
      const deletedAuthUsers = await prisma.authUser.deleteMany({
        where: {
          email: {
            in: [DEMO_INVESTOR.email.toLowerCase(), DEMO_INVESTOR_KISTI.email.toLowerCase(), DEMO_ADMIN.email.toLowerCase()],
          },
        },
      });
      console.log(
        `Cleanup: removed ${deletedTransactions.count} transactions, ${deletedRequests.count} requests, ` +
          `${deletedCertificates.count} certificates, ${deletedInvestments.count} investments, ` +
          `${deletedGroups.count} payment groups, ${deletedInvestors.count} investors, ${deletedStaff.count} demo staff row, ` +
          `${deletedLeads.count} leads, ${deletedAuthUsers.count} auth users.`,
      );
    } catch (error) {
      console.warn(`Cleanup: DB cleanup failed (tolerated): ${error instanceof Error ? error.message : error}`);
    } finally {
      await prisma.$disconnect();
    }
  } else {
    console.warn('Cleanup: no DATABASE_URL — skipping DB rows.');
  }
}

if (isProduction && !allowSeed) {
  console.error('Refusing to seed demo data in production. Set SEED_ALLOW=true only for explicit local approval.');
  process.exit(1);
}

// Fixed UIDs far from the real sequence range (the live investment_uid_seq
// starts at 1), formatted exactly like the app generates them.
const INSTANT_UID = 'NHL-S-009001';
const INSTANT_UID_SEQUENCE = 9001;
const KISTI_UID = 'NHL-S-009002';
const KISTI_UID_SEQUENCE = 9002;

// Verification codes follow the real format: NB- + 6 chars from the
// unambiguous alphabet (CODE_ALPHABET — no I/O/0/1). Fixed values keep the
// demo reproducible across re-seeds.
const INSTANT_CODE = 'NB-D3MA92';
const KISTI_CODE = 'NB-K57B24';

// Kisti plan: 4 kistis of ৳50,000 (1 share × INSTALLMENT_UNIT_AMOUNT), due
// every 6 months. Kisti 1 is already paid — the plan is "going on".
const KISTI_UNIT_AMOUNT = DEFAULT_SETTINGS.INSTALLMENT_UNIT_AMOUNT;
const KISTI_DUE_DATES = [
  new Date('2026-09-20T00:00:00.000Z'),
  new Date('2027-03-20T00:00:00.000Z'),
  new Date('2027-09-20T00:00:00.000Z'),
  new Date('2028-03-20T00:00:00.000Z'),
] as const;

async function ensureAuthUser(
  tx: TransactionClient,
  email: string,
  password: string,
  role: 'INVESTOR' | 'ADMIN',
): Promise<string> {
  const passwordHash = await hashPassword(password);
  const normEmail = email.toLowerCase();
  const user = await tx.authUser.upsert({
    where: { email: normEmail },
    update: { passwordHash, role, emailVerifiedAt: new Date() },
    create: {
      email: normEmail,
      passwordHash,
      role,
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
  return user.id;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  try {
    await prisma.$transaction(async (tx: TransactionClient) => {
      const sharePrice = DEFAULT_SETTINGS.SHARE_PRICE;
      const incentivePerShare = DEFAULT_SETTINGS.INCENTIVE_PER_SHARE;
      const recentDate = new Date('2026-08-20T10:00:00.000Z');

      // --- Settings — all nine, so this seed alone fully equips a fresh DB ---
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        await tx.setting.upsert({
          where: { key },
          update: { value: BigInt(value) },
          create: { key, value: BigInt(value) },
        });
      }

      // --- Own-auth AuthUser rows ---
      const adminAuthUserId = await ensureAuthUser(tx, DEMO_ADMIN.email, DEMO_ADMIN.password, 'ADMIN');
      const investorAuthUserId = await ensureAuthUser(tx, DEMO_INVESTOR.email, DEMO_INVESTOR.password, 'INVESTOR');
      const kistiAuthUserId = await ensureAuthUser(tx, DEMO_INVESTOR_KISTI.email, DEMO_INVESTOR_KISTI.password, 'INVESTOR');

      // --- Demo admin staff row ---
      const demoAdmin = await tx.staff.upsert({
        where: { email: 'demo-admin@neobee.test' },
        update: {
          name: DEMO_ADMIN.name,
          email: 'demo-admin@neobee.test',
          role: 'ADMIN',
          isActive: true,
          authUserId: adminAuthUserId,
        },
        create: {
          authUserId: adminAuthUserId,
          name: DEMO_ADMIN.name,
          email: 'demo-admin@neobee.test',
          role: 'ADMIN',
          isActive: true,
        },
      });

      if (demoAdmin.authUserId !== adminAuthUserId) {
        await tx.staff.update({
          where: { id: demoAdmin.id },
          data: { authUserId: adminAuthUserId },
        });
      }

      // --- Investor A: Rahim Uddin — 1 share, instant (full) payment, fully paid ---
      const instantInvestor = await tx.investor.upsert({
        where: { phone: DEMO_INVESTOR.phone },
        update: {
          name: DEMO_INVESTOR.name,
          email: DEMO_INVESTOR.email,
          authUserId: investorAuthUserId,
        },
        create: {
          phone: DEMO_INVESTOR.phone,
          name: DEMO_INVESTOR.name,
          email: DEMO_INVESTOR.email,
          nationalIdNumber: 'DEMO-NID-0001',
          authUserId: investorAuthUserId,
          approvalStatus: 'APPROVED',
        },
      });

      if (instantInvestor.authUserId !== investorAuthUserId) {
        await tx.investor.update({
          where: { id: instantInvestor.id },
          data: { authUserId: investorAuthUserId },
        });
      }

      const instantShares = 1;
      const instantAmount = calculateAmount(instantShares, sharePrice);
      const fullyPaidAt = new Date('2026-08-20T12:00:00.000Z');
      const instantInvestment = await tx.investment.upsert({
        where: { uid: INSTANT_UID },
        update: {
          investorId: instantInvestor.id,
          shares: instantShares,
          category: deriveCategory(instantShares),
          isEntrepreneur: false,
          incentiveAmount: 0,
          sharePrice,
          incentivePerShare,
          amount: instantAmount,
          code: INSTANT_CODE,
          depositMethod: 'BANK_TRANSFER',
          depositRef: 'DEMO-001',
          depositDate: recentDate,
          status: 'CONFIRMED',
          confirmedAt: fullyPaidAt,
          confirmedByInvestorId: instantInvestor.id,
          fullyPaidAt,
          notes: 'Demo instant-pay investment (fully paid)',
          recordedByStaffId: demoAdmin.id,
        },
        create: {
          investorId: instantInvestor.id,
          uid: INSTANT_UID,
          uidSequence: INSTANT_UID_SEQUENCE,
          code: INSTANT_CODE,
          shares: instantShares,
          category: deriveCategory(instantShares),
          isEntrepreneur: false,
          incentiveAmount: 0,
          sharePrice,
          incentivePerShare,
          amount: instantAmount,
          depositMethod: 'BANK_TRANSFER',
          depositRef: 'DEMO-001',
          depositDate: recentDate,
          status: 'CONFIRMED',
          confirmedAt: fullyPaidAt,
          confirmedByInvestorId: instantInvestor.id,
          fullyPaidAt,
          notes: 'Demo instant-pay investment (fully paid)',
          recordedByStaffId: demoAdmin.id,
        },
      });

      const existingInstantTx = await tx.transaction.findFirst({
        where: { investmentId: instantInvestment.id, type: 'DEPOSIT' },
        select: { id: true },
      });
      if (!existingInstantTx) {
        await tx.transaction.create({
          data: {
            investmentId: instantInvestment.id,
            amount: instantAmount,
            type: 'DEPOSIT',
            depositMethod: 'BANK_TRANSFER',
            depositDate: recentDate,
            recordedByStaffId: demoAdmin.id,
            note: 'Demo seeded deposit ledger row',
          },
        });
      }

      // Certificate exists only for the fully-paid holding.
      await tx.certificate.upsert({
        where: { investmentId: instantInvestment.id },
        update: {},
        create: { investmentId: instantInvestment.id },
      });

      // --- Investor B: Sultana Begum — 1 share on a kisti plan, in progress ---
      const kistiInvestor = await tx.investor.upsert({
        where: { phone: DEMO_INVESTOR_KISTI.phone },
        update: {
          name: DEMO_INVESTOR_KISTI.name,
          email: DEMO_INVESTOR_KISTI.email,
          authUserId: kistiAuthUserId,
        },
        create: {
          phone: DEMO_INVESTOR_KISTI.phone,
          name: DEMO_INVESTOR_KISTI.name,
          email: DEMO_INVESTOR_KISTI.email,
          nationalIdNumber: 'DEMO-NID-0002',
          authUserId: kistiAuthUserId,
          approvalStatus: 'APPROVED',
        },
      });

      if (kistiInvestor.authUserId !== kistiAuthUserId) {
        await tx.investor.update({
          where: { id: kistiInvestor.id },
          data: { authUserId: kistiAuthUserId },
        });
      }

      const kistiAmount = calculateAmount(1, sharePrice);
      const kistiInvestment = await tx.investment.upsert({
        where: { uid: KISTI_UID },
        update: {
          investorId: kistiInvestor.id,
          shares: 1,
          category: deriveCategory(1),
          isEntrepreneur: false,
          incentiveAmount: 0,
          sharePrice,
          incentivePerShare,
          amount: kistiAmount,
          paymentPlan: 'INSTALLMENT',
          code: KISTI_CODE,
          depositMethod: 'MOBILE_BANKING',
          depositRef: 'DEMO-002',
          depositDate: recentDate,
          status: 'PENDING',
          confirmedAt: null,
          confirmedByInvestorId: null,
          fullyPaidAt: null,
          notes: 'Demo kisti investment (in progress)',
          recordedByStaffId: demoAdmin.id,
        },
        create: {
          investorId: kistiInvestor.id,
          uid: KISTI_UID,
          uidSequence: KISTI_UID_SEQUENCE,
          code: KISTI_CODE,
          shares: 1,
          category: deriveCategory(1),
          isEntrepreneur: false,
          incentiveAmount: 0,
          sharePrice,
          incentivePerShare,
          amount: kistiAmount,
          paymentPlan: 'INSTALLMENT',
          depositMethod: 'MOBILE_BANKING',
          depositRef: 'DEMO-002',
          depositDate: recentDate,
          status: 'PENDING',
          notes: 'Demo kisti investment (in progress)',
          recordedByStaffId: demoAdmin.id,
        },
      });

      // Kisti agreement (NHL-K group) covering the share.
      const kistiGroup = await tx.paymentGroup.upsert({
        where: { ref: 'NHL-K-000001' },
        update: {
          investorId: kistiInvestor.id,
          kind: 'KISTI',
          shareCount: 1,
          totalAmount: kistiAmount,
        },
        create: {
          ref: 'NHL-K-000001',
          refSequence: 1,
          investorId: kistiInvestor.id,
          kind: 'KISTI',
          shareCount: 1,
          totalAmount: kistiAmount,
        },
      });

      await tx.investment.update({
        where: { id: kistiInvestment.id },
        data: { paymentGroupId: kistiGroup.id },
      });

      // Four kisti schedules; kisti 1 is PAID (ledger row linked), 2–4 SCHEDULED.
      // Rows carry both the owning investment and the NHL-K group, matching
      // createInvestmentRecord's convention for kisti agreements.
      for (let installmentNo = 1; installmentNo <= 4; installmentNo += 1) {
        const paid = installmentNo === 1;
        await tx.installmentSchedule.upsert({
          where: { paymentGroupId_installmentNo: { paymentGroupId: kistiGroup.id, installmentNo } },
          update: {
            investmentId: kistiInvestment.id,
            amount: KISTI_UNIT_AMOUNT,
            dueDate: KISTI_DUE_DATES[installmentNo - 1],
            status: paid ? 'PAID' : 'SCHEDULED',
          },
          create: {
            investmentId: kistiInvestment.id,
            paymentGroupId: kistiGroup.id,
            installmentNo,
            dueDate: KISTI_DUE_DATES[installmentNo - 1],
            amount: KISTI_UNIT_AMOUNT,
            status: paid ? 'PAID' : 'SCHEDULED',
          },
        });
      }

      const paidSchedule = await tx.installmentSchedule.findFirst({
        where: { paymentGroupId: kistiGroup.id, installmentNo: 1 },
        select: { id: true },
      });
      const existingKistiTx = await tx.transaction.findFirst({
        where: { investmentId: kistiInvestment.id, type: 'DEPOSIT' },
        select: { id: true },
      });
      if (!existingKistiTx) {
        await tx.transaction.create({
          data: {
            investmentId: kistiInvestment.id,
            amount: KISTI_UNIT_AMOUNT,
            type: 'DEPOSIT',
            depositMethod: 'MOBILE_BANKING',
            depositDate: new Date('2026-09-18T10:00:00.000Z'),
            installmentScheduleId: paidSchedule?.id ?? null,
            recordedByStaffId: demoAdmin.id,
            note: 'Kisti 1 paid via bKash — demo ledger row',
          },
        });
      }

      // --- One SUBMITTED share request from investor A — populates the
      // admin approval queue and the portal "Your requests" list. ---
      const existingShareRequest = await tx.investmentRequest.findFirst({
        where: { investorId: instantInvestor.id, kind: 'SHARE_PURCHASE', status: 'SUBMITTED' },
        select: { id: true },
      });
      if (!existingShareRequest) {
        await tx.investmentRequest.create({
          data: {
            investorId: instantInvestor.id,
            kind: 'SHARE_PURCHASE',
            shares: 2,
            entrepreneurRequested: false,
            paymentPlan: 'FULL',
            sharePrice,
            incentivePerShare,
            amount: 380000, // 2 × (৳2,00,000 − ৳10,000 full-payment discount)
            depositMethod: 'BANK_TRANSFER',
            depositRef: 'BKX-DEMO-9001',
            depositDate: new Date('2026-09-03T10:00:00.000Z'),
            note: 'Requesting 2 additional shares — full payment, reference BKX-DEMO-9001',
            status: 'SUBMITTED',
          },
        });
      }

      // --- Interest leads — populate the admin leads pipeline and the
      // sidebar "new leads" badge. Two NEW + one CONTACTED. ---
      const DEMO_LEADS = [
        { ref: 'NB-LEAD-DEMO', name: 'Sabbir Ahmed', phone: '+8801811000111', email: 'sabbir.ahmed@example.com', message: 'Want to visit the site office and discuss founding-entrepreneur entry.', status: 'NEW' as const },
        { ref: 'NB-LEAD-K9LM', name: 'Farhana Yasmin', phone: '+8801933000222', email: 'farhana.y@example.com', message: 'Interested in a 5-share premium entry. Please call after 5pm.', status: 'NEW' as const },
        { ref: 'NB-LEAD-QRTV', name: 'Mahbub Alam', phone: '+8801712000333', email: null, message: null, status: 'CONTACTED' as const },
      ];
      for (const lead of DEMO_LEADS) {
        const existingLead = await tx.lead.findUnique({ where: { ref: lead.ref }, select: { id: true } });
        if (!existingLead) {
          await tx.lead.create({
            data: {
              ...lead,
              contactedAt: lead.status === 'CONTACTED' ? new Date('2026-08-27T09:30:00.000Z') : null,
              contactedByStaffId: lead.status === 'CONTACTED' ? demoAdmin.id : null,
            },
          });
        }
      }

      console.log(
        'Demo seed complete: 1 admin, 2 investors (instant-pay + kisti in progress), 2 investments, ' +
          '1 kisti agreement with 4 schedules (1 paid), 1 pending share request, 3 interest leads. ' +
          'Auth users created directly in database.',
      );
    });
  } catch (error) {
    console.error('Demo seed failed:', error);
    process.exitCode = 1;
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
