import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../lib/generated/prisma/client';
import type { TransactionClient } from '../lib/generated/prisma/internal/prismaNamespace';
// Relative import is deliberate here because tsx does not resolve the @/ alias in this standalone script.
import {
  DEFAULT_SETTINGS,
  calculateAmount,
  calculateIncentive,
  deriveCategory,
  formatUid,
  generateVerificationCode,
} from '../lib/money';

const isProduction = process.env.NODE_ENV === 'production';
const allowSeed = process.env.SEED_ALLOW === 'true';

if (isProduction && !allowSeed) {
  console.error('Refusing to seed in production. Set SEED_ALLOW=true only for explicit local approval.');
  process.exit(1);
}

type SeededInvestment = {
  shares: number;
  depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING';
  depositDate: Date;
  status: 'PENDING' | 'CONFIRMED';
  confirmedAt?: Date;
  confirmedByInvestorId?: string;
  notes: string;
};

const settings = [
  ['SHARE_PRICE', DEFAULT_SETTINGS.SHARE_PRICE],
  ['INCENTIVE_PER_SHARE', DEFAULT_SETTINGS.INCENTIVE_PER_SHARE],
  ['TARGET_AMOUNT', DEFAULT_SETTINGS.TARGET_AMOUNT],
  ['TARGET_SHARES', DEFAULT_SETTINGS.TARGET_SHARES],
  ['FOUNDING_AMOUNT', DEFAULT_SETTINGS.FOUNDING_AMOUNT],
  ['TARGET_ENTREPRENEURS', DEFAULT_SETTINGS.TARGET_ENTREPRENEURS],
  ['FULL_PAYMENT_DISCOUNT_PER_SHARE', DEFAULT_SETTINGS.FULL_PAYMENT_DISCOUNT_PER_SHARE],
  ['INSTALLMENT_UNIT_AMOUNT', DEFAULT_SETTINGS.INSTALLMENT_UNIT_AMOUNT],
  ['INSTALLMENT_COUNT', DEFAULT_SETTINGS.INSTALLMENT_COUNT],
] as const;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  try {
    await prisma.$transaction(async (tx: TransactionClient) => {

      for (const [key, value] of settings) {
        await tx.setting.upsert({
          where: { key },
          update: { value: BigInt(value) },
          create: { key, value: BigInt(value) },
        });
      }

      const admin = await tx.staff.upsert({
        where: { authUserId: 'seed-admin-authuser-0001' },
        update: { name: 'Test Admin', email: 'admin@example.test', role: 'ADMIN', isActive: true },
        create: {
          authUserId: 'seed-admin-authuser-0001',
          name: 'Test Admin',
          email: 'admin@example.test',
          role: 'ADMIN',
          isActive: true,
        },
      });

      const staff = await tx.staff.upsert({
        where: { authUserId: 'seed-staff-authuser-0001' },
        update: { name: 'Test Staff', email: 'staff@example.test', role: 'STAFF', isActive: true },
        create: {
          authUserId: 'seed-staff-authuser-0001',
          name: 'Test Staff',
          email: 'staff@example.test',
          role: 'STAFF',
          isActive: true,
        },
      });

      const existingInvestor = await tx.investor.findFirst({
        where: { phone: '+8801700000001' },
        select: { id: true },
      });
      if (existingInvestor) {
        console.log('Investors already seeded, skipping investors, investments, transactions, and audit logs.');
        return;
      }

      const investorSpecs = [
        { phone: '+8801700000001', name: 'Seed Investor 1', email: 'investor1@example.test', nid: 'TEST-NID-0001' },
        { phone: '+8801700000002', name: 'Seed Investor 2', email: 'investor2@example.test', nid: 'TEST-NID-0002' },
        { phone: '+8801700000003', name: 'Seed Investor 3', email: 'investor3@example.test', nid: 'TEST-NID-0003' },
        { phone: '+8801700000004', name: 'Seed Investor 4', email: 'investor4@example.test', nid: 'TEST-NID-0004' },
        { phone: '+8801700000005', name: 'Seed Investor 5', email: 'investor5@example.test', nid: 'TEST-NID-0005' },
      ] as const;

      const investors = [] as Array<{ id: string; phone: string }>;
      for (const investor of investorSpecs) {
        const row = await tx.investor.create({
          data: {
            authUserId: null,
            phone: investor.phone,
            name: investor.name,
            email: investor.email,
            nationalIdNumber: investor.nid,
          },
          select: { id: true, phone: true },
        });
        investors.push(row);
      }

      const investmentSpecs: SeededInvestment[] = [
        {
          shares: 1,
          depositMethod: 'BANK_DEPOSIT',
          depositDate: new Date('2025-01-05T10:00:00.000Z'),
          status: 'PENDING',
          notes: 'Seed investment 1',
        },
        {
          shares: 4,
          depositMethod: 'BANK_TRANSFER',
          depositDate: new Date('2025-01-06T10:00:00.000Z'),
          status: 'CONFIRMED',
          confirmedAt: new Date('2025-01-06T12:00:00.000Z'),
          confirmedByInvestorId: investors[1].id,
          notes: 'Seed investment 2',
        },
        {
          shares: 5,
          depositMethod: 'CHEQUE',
          depositDate: new Date('2025-01-07T10:00:00.000Z'),
          status: 'PENDING',
          notes: 'Seed investment 3',
        },
        {
          shares: 9,
          depositMethod: 'MOBILE_BANKING',
          depositDate: new Date('2025-01-08T10:00:00.000Z'),
          status: 'CONFIRMED',
          confirmedAt: new Date('2025-01-08T12:00:00.000Z'),
          confirmedByInvestorId: investors[3].id,
          notes: 'Seed investment 4',
        },
        {
          shares: 10,
          depositMethod: 'BANK_DEPOSIT',
          depositDate: new Date('2025-01-09T10:00:00.000Z'),
          status: 'CONFIRMED',
          confirmedAt: new Date('2025-01-09T12:00:00.000Z'),
          confirmedByInvestorId: investors[4].id,
          notes: 'Seed investment 5',
        },
      ];

      const investmentRows = [] as Array<{ id: string; amount: number }>;
      for (let i = 0; i < investmentSpecs.length; i += 1) {
        const investor = investors[i];
        const spec = investmentSpecs[i];
        const shares = spec.shares;
        const category = deriveCategory(shares);
        const sharePrice = DEFAULT_SETTINGS.SHARE_PRICE;
        const incentivePerShare = DEFAULT_SETTINGS.INCENTIVE_PER_SHARE;
        const amount = calculateAmount(shares, sharePrice);
        const isEntrepreneur = shares >= 10;
        const incentiveAmount = calculateIncentive(shares, isEntrepreneur, incentivePerShare);
        const code = generateVerificationCode();
        const [{ seq }] = await tx.$queryRaw<Array<{ seq: bigint }>>`SELECT nextval('investment_uid_seq') AS seq`;
        const uidSequence = Number(seq);
        const uid = formatUid(uidSequence);
        // Do not hardcode NEO-0001..NEO-0005; the real app consumes nextval('investment_uid_seq') and the sequence must advance here too.

        const investment = await tx.investment.create({
          data: {
            investorId: investor.id,
            uid,
            uidSequence,
            code,
            shares,
            category,
            isEntrepreneur,
            incentiveAmount,
            sharePrice,
            incentivePerShare,
            amount,
            depositMethod: spec.depositMethod,
            depositDate: spec.depositDate,
            status: spec.status,
            confirmedAt: spec.confirmedAt ?? null,
            confirmedByInvestorId: spec.confirmedByInvestorId ?? null,
            notes: spec.notes,
            recordedByStaffId: staff.id,
          },
          select: { id: true, amount: true },
        });

        await tx.transaction.create({
          data: {
            investmentId: investment.id,
            amount: investment.amount,
            type: 'DEPOSIT',
            recordedByStaffId: admin.id,
            note: 'Initial seeded deposit ledger row',
          },
        });

        const ledgerSum = await tx.transaction.aggregate({
          where: { investmentId: investment.id },
          _sum: { amount: true },
        });
        if (ledgerSum._sum.amount !== investment.amount) {
          throw new Error(`Ledger mismatch for investment ${investment.id}`);
        }

        await tx.auditLog.create({
          data: {
            actorType: 'STAFF',
            actorId: staff.id,
            action: 'investment.register',
            targetType: 'Investment',
            targetId: investment.id,
            metadata: Prisma.JsonNull,
          },
        });

        investmentRows.push(investment);
      }

      console.log(`Seeded ${settings.length} settings, 2 staff, ${investors.length} investors, ${investmentRows.length} investments, ${investmentRows.length} transactions, and ${investmentRows.length} audit logs.`);
    });
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
