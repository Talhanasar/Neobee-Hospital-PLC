// Demo seed — creates the two demo auth users + DB rows used by the
// one-click demo-login affordance. Idempotent: safe to re-run.
//
// Run via `pnpm db:seed` (chained after prisma/seed.ts) or standalone:
//   npx tsx prisma/seed-demo.ts
//
// Respects the same SEED_ALLOW production gate as seed.ts.

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../lib/generated/prisma/client';
import type { TransactionClient } from '../lib/generated/prisma/internal/prismaNamespace';
// Relative import is deliberate here because tsx does not resolve the @/ alias in this standalone script.
import {
  DEFAULT_SETTINGS,
  calculateAmount,
  deriveCategory,
} from '../lib/money';
import { DEMO_INVESTOR, DEMO_ADMIN } from '../lib/demo-users';

const isProduction = process.env.NODE_ENV === 'production';
const allowSeed = process.env.SEED_ALLOW === 'true';

// ── Cleanup mode ─────────────────────────────────────────────────
// `npx tsx prisma/seed-demo.ts --cleanup` removes every demo-marked row
// (phones +88017900000*, UIDs NEO-90*, @neobee.test emails/staff) and the
// two demo auth users from hosted Supabase. Tolerant: missing rows are fine.
if (process.argv.includes('--cleanup')) {
  void cleanup().then(() => process.exit(0));
} else {
  void main();
}

async function deleteDemoAuthUsers(): Promise<void> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    console.warn('Cleanup: skipping auth-user deletion (no service key/URL).');
    return;
  }
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const demoEmails: string[] = [DEMO_INVESTOR.email, DEMO_ADMIN.email];
  const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) {
    console.warn(`Cleanup: could not list auth users: ${error.message}`);
    return;
  }
  for (const user of list.users) {
    if (user.email && demoEmails.includes(user.email.toLowerCase())) {
      const { error: delError } = await admin.auth.admin.deleteUser(user.id);
      console.log(`Cleanup: auth user ${user.email} ${delError ? `NOT deleted: ${delError.message}` : 'deleted'}.`);
    }
  }
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
        where: { OR: [{ uid: { startsWith: 'NEO-90' } }, { investorId: { in: investorIds } }] },
        select: { id: true },
      });
      const investmentIds = demoInvestments.map((i) => i.id);
      const deletedTransactions = await prisma.transaction.deleteMany({ where: { investmentId: { in: investmentIds } } });
      const deletedRequests = await prisma.investmentRequest.deleteMany({
        where: { OR: [{ investorId: { in: investorIds } }, { targetInvestmentId: { in: investmentIds } }] },
      });
      const deletedInvestments = await prisma.investment.deleteMany({ where: { id: { in: investmentIds } } });
      const deletedInvestors = await prisma.investor.deleteMany({ where: { id: { in: investorIds } } });
      const deletedStaff = await prisma.staff.deleteMany({ where: { email: 'demo-admin@neobee.test' } });
      const deletedLeads = await prisma.lead.deleteMany({ where: { ref: { startsWith: 'NB-LEAD-' } } });
      console.log(
        `Cleanup: removed ${deletedTransactions.count} transactions, ${deletedRequests.count} requests, ` +
          `${deletedInvestments.count} investments, ${deletedInvestors.count} investors, ${deletedStaff.count} demo staff row, ${deletedLeads.count} leads.`,
      );
    } catch (error) {
      console.warn(`Cleanup: DB cleanup failed (tolerated): ${error instanceof Error ? error.message : error}`);
    } finally {
      await prisma.$disconnect();
    }
  } else {
    console.warn('Cleanup: no DATABASE_URL — skipping DB rows.');
  }
  await deleteDemoAuthUsers();
}

if (isProduction && !allowSeed) {
  console.error('Refusing to seed demo data in production. Set SEED_ALLOW=true only for explicit local approval.');
  process.exit(1);
}

// Fixed UIDs far from the real sequence range (seed.ts consumes nextval starting at 1).
const DEMO_INVESTOR_UID = 'NEO-9001';
const DEMO_INVESTOR_UID_SEQUENCE = 9001;
const DEMO_PENDING_UID = 'NEO-9002';
const DEMO_PENDING_UID_SEQUENCE = 9002;

const DEMO_CONFIRMED_CODE = 'NB-DEMOA';
const DEMO_PENDING_CODE = 'NB-DEMOB';

// Extra walk-in shareholders so the admin register and stats look alive.
// No auth users — these are staff-registered investors, exactly like reality.
const EXTRA_SHAREHOLDERS = [
  {
    phone: '+8801790000011',
    name: 'Kamrul Hasan',
    nid: 'DEMO-NID-0011',
    uid: 'NEO-9011',
    uidSequence: 9011,
    code: 'NB-DEMDCA',
    shares: 100,
    entrepreneur: true,
    status: 'CONFIRMED' as const,
    depositMethod: 'BANK_TRANSFER' as const,
    depositRef: 'DEMO-003',
  },
  {
    phone: '+8801790000012',
    name: 'Nusrat Jahan',
    nid: 'DEMO-NID-0012',
    uid: 'NEO-9012',
    uidSequence: 9012,
    code: 'NB-DEMDDB',
    shares: 25,
    entrepreneur: false,
    status: 'CONFIRMED' as const,
    depositMethod: 'BANK_DEPOSIT' as const,
    depositRef: 'DEMO-004',
  },
  {
    phone: '+8801790000013',
    name: 'Shahana Akter',
    nid: 'DEMO-NID-0013',
    uid: 'NEO-9013',
    uidSequence: 9013,
    code: 'NB-DEMDEC',
    shares: 5,
    entrepreneur: false,
    status: 'PENDING' as const,
    depositMethod: 'MOBILE_BANKING' as const,
    depositRef: 'DEMO-005',
  },
] as const;

async function ensureAuthUser(
  admin: Awaited<ReturnType<typeof import('../lib/supabase/admin').createAdminClient>>,
  email: string,
  password: string,
  name: string,
  phone: string,
): Promise<string | null> {
  // Email-based reuse detection: supabase-js v2.112.3 admin API has no getUserByEmail,
  // so reuse is detected by scanning listUsers for a matching email. The project has
  // only a handful of users, so a single page at perPage:200 is sufficient.
  const findExistingByEmail = async (): Promise<{ id: string } | null> => {
    const { data: list, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listError) {
      console.warn(`Could not list users to find existing demo user (${email}): ${listError.message}`);
      return null;
    }
    return list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
  };

  // Try create WITH phone first (so the profile carries it if the project later enables
  // phone). Some projects reject phone on create when the phone provider is disabled —
  // on that specific error, retry with email-only attributes.
  const tryCreate = async (withPhone: boolean) => {
    const attrs: Record<string, unknown> = {
      email,
      password,
      email_confirm: true,
      user_metadata: { name, phone },
    };
    if (withPhone) {
      attrs.phone = phone;
      attrs.phone_confirm = true;
    }
    return admin.auth.admin.createUser(attrs as Parameters<typeof admin.auth.admin.createUser>[0]);
  };

  // 1) Attempt create WITH phone.
  let createResult = await tryCreate(true);
  let createError = createResult.error;

  // 2) If the phone fields were rejected, retry WITHOUT phone (email-only).
  if (createError && /phone|provider|disabled/i.test(createError.message)) {
    console.warn(`createUser with phone rejected for ${email} (likely phone provider disabled); retrying email-only: ${createError.message}`);
    createResult = await tryCreate(false);
    createError = createResult.error;
  }

  if (createError) {
    // 422 / "already exists" → reuse the existing user by email.
    if (createError.status === 422 || /already.*registered|already.*exists|user.*already/i.test(createError.message)) {
      const existing = await findExistingByEmail();
      if (existing) {
        // Reset password so stale passwords can't break the demo after a re-run.
        const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, { password });
        if (updateError) {
          console.warn(`Found existing user for ${email} but failed to reset password: ${updateError.message}`);
        }
        console.log(`Reusing existing Supabase auth user for ${email} (${name}).`);
        return existing.id;
      }
      console.warn(`Existing user reported for ${email} but not found in listUsers.`);
      return null;
    }
    console.warn(`Failed to create Supabase auth user for ${email} (${name}): ${createError.message}`);
    return null;
  }

  if (createResult.data && createResult.data.user) {
    console.log(`Created Supabase auth user for ${email} (${name}).`);
    return createResult.data.user.id;
  }

  // Never report success without a returned user object.
  console.warn(`SEED FAILURE: could not create auth user for ${email}: no user object returned.`);
  return null;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }

  // --- Supabase auth users (optional: skip gracefully if no service key) ---
  let investorAuthUserId: string | null = null;
  let adminAuthUserId: string | null = null;
  let adminClient: Awaited<ReturnType<typeof import('../lib/supabase/admin').createAdminClient>> | null = null;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.warn(
      'SUPABASE_SERVICE_ROLE_KEY is not set — skipping Supabase auth-user creation. ' +
        'Demo login will not work until re-run with the key. DB rows will still be created.',
    );
  } else {
    const { createAdminClient } = await import('../lib/supabase/admin');
    adminClient = await createAdminClient();
    investorAuthUserId = await ensureAuthUser(adminClient, DEMO_INVESTOR.email, DEMO_INVESTOR.password, DEMO_INVESTOR.name, DEMO_INVESTOR.phone);
    adminAuthUserId = await ensureAuthUser(adminClient, DEMO_ADMIN.email, DEMO_ADMIN.password, DEMO_ADMIN.name, DEMO_ADMIN.phone);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  try {
    await prisma.$transaction(async (tx: TransactionClient) => {
      const sharePrice = DEFAULT_SETTINGS.SHARE_PRICE;
      const incentivePerShare = DEFAULT_SETTINGS.INCENTIVE_PER_SHARE;

      // --- Settings (reuse the same keys seed.ts upserts; do not duplicate) ---
      const settingRows = [
        ['SHARE_PRICE', sharePrice],
        ['INCENTIVE_PER_SHARE', incentivePerShare],
      ] as const;
      for (const [key, value] of settingRows) {
        await tx.setting.upsert({
          where: { key },
          update: { value: BigInt(value) },
          create: { key, value: BigInt(value) },
        });
      }

      // --- Demo admin staff row (upsert by the stable unique email so a stale
      // authUserId on the existing row never blocks the overwrite; authUserId is
      // always overwritten with the real Supabase user id when known) ---
      const demoAdmin = await tx.staff.upsert({
        where: { email: 'demo-admin@neobee.test' },
        update: {
          name: DEMO_ADMIN.name,
          email: 'demo-admin@neobee.test',
          role: 'ADMIN',
          isActive: true,
          ...(adminAuthUserId ? { authUserId: adminAuthUserId } : {}),
        },
        create: {
          authUserId: adminAuthUserId ?? 'demo-admin-authuser-pending',
          name: DEMO_ADMIN.name,
          email: 'demo-admin@neobee.test',
          role: 'ADMIN',
          isActive: true,
        },
      });

      // If the real auth user id arrived late, link it now.
      if (adminAuthUserId && demoAdmin.authUserId !== adminAuthUserId) {
        await tx.staff.update({
          where: { id: demoAdmin.id },
          data: { authUserId: adminAuthUserId },
        });
      }

      // --- Demo investor row (upsert by the stable unique phone; authUserId is
      // always overwritten with the real Supabase user id so stale/non-existent
      // ids on the existing row are corrected on every re-run) ---
      const demoInvestor = await tx.investor.upsert({
        where: { phone: DEMO_INVESTOR.phone },
        update: {
          name: DEMO_INVESTOR.name,
          email: 'demo-investor@neobee.test',
          ...(investorAuthUserId ? { authUserId: investorAuthUserId } : {}),
        },
        create: {
          phone: DEMO_INVESTOR.phone,
          name: DEMO_INVESTOR.name,
          email: 'demo-investor@neobee.test',
          nationalIdNumber: 'DEMO-NID-0001',
          authUserId: investorAuthUserId ?? 'demo-investor-authuser-pending',
        },
      });

      // Link the investor's authUserId if it was pending and the real id arrived.
      if (investorAuthUserId && demoInvestor.authUserId !== investorAuthUserId) {
        await tx.investor.update({
          where: { id: demoInvestor.id },
          data: { authUserId: investorAuthUserId },
        });
      }

      // --- Two demo investments (idempotent by uid) ---
      const recentDate = new Date('2026-08-20T10:00:00.000Z');

      // (a) CONFIRMED: 40 shares → PREMIUM, ৳80,00,000, investor-confirmed.
      const confirmedShares = 40;
      const confirmedCategory = deriveCategory(confirmedShares);
      const confirmedAmount = calculateAmount(confirmedShares, sharePrice);
      const confirmedInvestment = await tx.investment.upsert({
        where: { uid: DEMO_INVESTOR_UID },
        update: {
          investorId: demoInvestor.id,
          shares: confirmedShares,
          category: confirmedCategory,
          isEntrepreneur: false,
          incentiveAmount: 0,
          sharePrice,
          incentivePerShare,
          amount: confirmedAmount,
          depositMethod: 'BANK_TRANSFER',
          depositRef: 'DEMO-001',
          depositDate: recentDate,
          status: 'CONFIRMED',
          confirmedAt: new Date('2026-08-20T12:00:00.000Z'),
          confirmedByInvestorId: demoInvestor.id,
          notes: 'Demo confirmed investment',
          recordedByStaffId: demoAdmin.id,
        },
        create: {
          investorId: demoInvestor.id,
          uid: DEMO_INVESTOR_UID,
          uidSequence: DEMO_INVESTOR_UID_SEQUENCE,
          code: DEMO_CONFIRMED_CODE,
          shares: confirmedShares,
          category: confirmedCategory,
          isEntrepreneur: false,
          incentiveAmount: 0,
          sharePrice,
          incentivePerShare,
          amount: confirmedAmount,
          depositMethod: 'BANK_TRANSFER',
          depositRef: 'DEMO-001',
          depositDate: recentDate,
          status: 'CONFIRMED',
          confirmedAt: new Date('2026-08-20T12:00:00.000Z'),
          confirmedByInvestorId: demoInvestor.id,
          notes: 'Demo confirmed investment',
          recordedByStaffId: demoAdmin.id,
        },
      });

      // Ledger row for the confirmed investment (match seed.ts pattern: DEPOSIT row, admin-recorded).
      const existingConfirmedTx = await tx.transaction.findFirst({
        where: { investmentId: confirmedInvestment.id, type: 'DEPOSIT' },
        select: { id: true },
      });
      if (!existingConfirmedTx) {
        await tx.transaction.create({
          data: {
            investmentId: confirmedInvestment.id,
            amount: confirmedAmount,
            type: 'DEPOSIT',
            recordedByStaffId: demoAdmin.id,
            note: 'Demo seeded deposit ledger row',
          },
        });
      }

      // (b) PENDING: 20 shares → PREMIUM, ৳40,00,000, awaiting investor confirmation.
      const pendingShares = 20;
      const pendingCategory = deriveCategory(pendingShares);
      const pendingAmount = calculateAmount(pendingShares, sharePrice);
      const pendingInvestment = await tx.investment.upsert({
        where: { uid: DEMO_PENDING_UID },
        update: {
          investorId: demoInvestor.id,
          shares: pendingShares,
          category: pendingCategory,
          isEntrepreneur: false,
          incentiveAmount: 0,
          sharePrice,
          incentivePerShare,
          amount: pendingAmount,
          depositMethod: 'BANK_TRANSFER',
          depositRef: 'DEMO-002',
          depositDate: recentDate,
          status: 'PENDING',
          confirmedAt: null,
          confirmedByInvestorId: null,
          notes: 'Demo pending investment',
          recordedByStaffId: demoAdmin.id,
        },
        create: {
          investorId: demoInvestor.id,
          uid: DEMO_PENDING_UID,
          uidSequence: DEMO_PENDING_UID_SEQUENCE,
          code: DEMO_PENDING_CODE,
          shares: pendingShares,
          category: pendingCategory,
          isEntrepreneur: false,
          incentiveAmount: 0,
          sharePrice,
          incentivePerShare,
          amount: pendingAmount,
          depositMethod: 'BANK_TRANSFER',
          depositRef: 'DEMO-002',
          depositDate: recentDate,
          status: 'PENDING',
          confirmedAt: null,
          confirmedByInvestorId: null,
          notes: 'Demo pending investment',
          recordedByStaffId: demoAdmin.id,
        },
      });

      const existingPendingTx = await tx.transaction.findFirst({
        where: { investmentId: pendingInvestment.id, type: 'DEPOSIT' },
        select: { id: true },
      });
      if (!existingPendingTx) {
        await tx.transaction.create({
          data: {
            investmentId: pendingInvestment.id,
            amount: pendingAmount,
            type: 'DEPOSIT',
            recordedByStaffId: demoAdmin.id,
            note: 'Demo seeded deposit ledger row',
          },
        });
      }

      // (c) Extra walk-in shareholders — admin register + stats richness.
      for (const person of EXTRA_SHAREHOLDERS) {
        const extraInvestor = await tx.investor.upsert({
          where: { phone: person.phone },
          update: { name: person.name },
          create: {
            phone: person.phone,
            name: person.name,
            nationalIdNumber: person.nid,
            authUserId: null, // staff-registered walk-in — no account yet
          },
        });
        const category = deriveCategory(person.shares);
        const amount = calculateAmount(person.shares, sharePrice);
        const incentiveAmount = person.entrepreneur ? person.shares * incentivePerShare : 0;
        const investment = await tx.investment.upsert({
          where: { uid: person.uid },
          update: {
            investorId: extraInvestor.id,
            shares: person.shares,
            category,
            isEntrepreneur: person.entrepreneur,
            incentiveAmount,
            sharePrice,
            incentivePerShare,
            amount,
            depositMethod: person.depositMethod,
            depositRef: person.depositRef,
            depositDate: recentDate,
            status: person.status,
            recordedByStaffId: demoAdmin.id,
          },
          create: {
            investorId: extraInvestor.id,
            uid: person.uid,
            uidSequence: person.uidSequence,
            code: person.code,
            shares: person.shares,
            category,
            isEntrepreneur: person.entrepreneur,
            incentiveAmount,
            sharePrice,
            incentivePerShare,
            amount,
            depositMethod: person.depositMethod,
            depositRef: person.depositRef,
            depositDate: recentDate,
            status: person.status,
            notes: 'Demo seeded shareholder',
            recordedByStaffId: demoAdmin.id,
          },
        });
        const existingExtraTx = await tx.transaction.findFirst({
          where: { investmentId: investment.id, type: 'DEPOSIT' },
          select: { id: true },
        });
        if (!existingExtraTx) {
          await tx.transaction.create({
            data: {
              investmentId: investment.id,
              amount,
              type: 'DEPOSIT',
              recordedByStaffId: demoAdmin.id,
              note: 'Demo seeded deposit ledger row',
            },
          });
        }
      }

      // (d) One SUBMITTED payment report from the demo investor — populates
      // "Your requests" in the portal and the staff approval queue.
      const existingPaymentRequest = await tx.investmentRequest.findFirst({
        where: { investorId: demoInvestor.id, kind: 'PAYMENT', status: 'SUBMITTED' },
        select: { id: true },
      });
      if (!existingPaymentRequest) {
        await tx.investmentRequest.create({
          data: {
            investorId: demoInvestor.id,
            kind: 'PAYMENT',
            targetInvestmentId: confirmedInvestment.id,
            shares: 0,
            entrepreneurRequested: false,
            sharePrice,
            incentivePerShare,
            amount: 500000,
            depositMethod: 'MOBILE_BANKING',
            depositRef: 'BKX-DEMO-7788',
            depositDate: new Date('2026-08-26T10:00:00.000Z'),
            note: 'Installment no. 2 paid via bKTransaction — reference BKX-DEMO-7788',
            status: 'SUBMITTED',
          },
        });
      }

      // (e) Interest leads — populate the admin leads pipeline and the
      // sidebar "new leads" badge. Two NEW + one CONTACTED.
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
        'Demo seed complete: 1 admin staff, 4 investors (1 demo + 3 walk-ins), 5 investments, ledger rows, 1 payment request, 3 interest leads. ' +
          (investorAuthUserId ? 'Auth users created.' : 'Auth users SKIPPED (no service key).'),
      );
    });

    // --- Final verification: re-confirm BOTH auth users exist (by id) and print
    // a final line listing exactly which accounts exist, by email (never ids).
    // If either is missing → exit 1 so CI surfaces the failure. ---
    if (adminClient && serviceRoleKey) {
      const verify = async (id: string | null, email: string, label: string): Promise<boolean> => {
        if (!id) return false;
        const { data, error } = await adminClient!.auth.admin.getUserById(id);
        if (error || !data.user) {
          console.error(`SEED FAILURE: verified auth user for ${email} (${label}) is missing: ${error ? error.message : 'no user'}`);
          return false;
        }
        return true;
      };

      const investorOk = await verify(investorAuthUserId, DEMO_INVESTOR.email, 'investor');
      const adminOk = await verify(adminAuthUserId, DEMO_ADMIN.email, 'admin');

      const existingEmails: string[] = [];
      const { data: list, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (listError) {
        console.error('SEED FAILURE: could not list users for final verification:', listError.message);
      } else {
        for (const u of list.users) {
          if (u.email) existingEmails.push(u.email);
        }
      }

      console.log(`Verified auth users: investor=${investorOk ? 'present' : 'MISSING'} (${DEMO_INVESTOR.email}), admin=${adminOk ? 'present' : 'MISSING'} (${DEMO_ADMIN.email}).`);
      console.log(`Auth accounts present: ${existingEmails.length ? existingEmails.join(', ') : 'none'}`);

      if (!investorOk || !adminOk) {
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('Demo seed failed:', error);
    process.exitCode = 1;
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
