/**
 * Integration tests for investment API routes.
 * Runs against an ephemeral Postgres cluster.
 * Mocks ONLY @/lib/supabase/server for auth boundary.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';
import { InvestmentStatus, TransactionType, ActorType, StaffRole, InvestmentRequestStatus } from '@/lib/generated/prisma/client';
import { registerInvestment } from '@/lib/investments';
import { writeAuditLog, actionVerbs } from '@/lib/audit';
import { generateVerificationCode, formatUid, calculateAmount } from '@/lib/money';
import { DEFAULT_SETTINGS } from '@/lib/money';
import type { RegisterInvestmentInput } from '@/lib/validation';
import { submitInvestmentRequest, approveInvestmentRequest, rejectInvestmentRequest } from '@/lib/requests';

// Test utilities
const TEST_PORT = 54329;
const TEST_CONNECTION_STRING = `postgresql://postgres@127.0.0.1:${TEST_PORT}/postgres`;

let prisma: PrismaClient;
let testStaff: { id: string; authUserId: string };
let testInvestor: { id: string; authUserId: string | null; phone: string };
let testInvestor2: { id: string; authUserId: string | null; phone: string };
let testInvestment: { id: string; uid: string; code: string; investorId: string };

// Mock Supabase auth at the module boundary
const mockCreateClient = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

function makeRequest(url: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) {
    headers.set('content-type', 'application/json');
  }
  return new Request(url, { ...init, headers });
}

function makeAuthMock(userId: string | null) {
  mockCreateClient.mockReturnValue({
    auth: {
      getUser: async () => ({
        data: userId ? { user: { id: userId } } : { user: null },
        error: null,
      }),
    },
  });
}

async function setupTestData() {
  // Create test staff
  testStaff = await prisma.staff.create({
    data: {
      authUserId: 'test-staff-auth-001',
      name: 'Test Staff',
      email: 'staff@test.com',
      role: StaffRole.STAFF,
      isActive: true,
    },
    select: { id: true, authUserId: true },
  });

  // Create test investor 1
  testInvestor = await prisma.investor.create({
    data: {
      authUserId: 'test-investor-auth-001',
      phone: '+8801700000001',
      name: 'Test Investor One',
      email: 'investor1@test.com',
      nationalIdNumber: 'TEST-NID-001',
    },
    select: { id: true, authUserId: true, phone: true },
  });

  // Create test investor 2 (for non-ownership tests)
  testInvestor2 = await prisma.investor.create({
    data: {
      authUserId: 'test-investor-auth-002',
      phone: '+8801700000002',
      name: 'Test Investor Two',
      email: 'investor2@test.com',
      nationalIdNumber: 'TEST-NID-002',
    },
    select: { id: true, authUserId: true, phone: true },
  });
}

async function cleanupTestData() {
  // Clean up in reverse order of dependencies
  await prisma.auditLog.deleteMany({ where: { targetType: 'Investment' } });
  await prisma.transaction.deleteMany({});
  await prisma.investment.deleteMany({});
  await prisma.investor.deleteMany({ where: { id: { in: [testInvestor?.id, testInvestor2?.id].filter(Boolean) } } });
  await prisma.staff.deleteMany({ where: { id: testStaff?.id } });
}

async function createTestInvestment(overrides: Partial<RegisterInvestmentInput> = {}) {
  const input: RegisterInvestmentInput = {
    name: 'Test Investor',
    phone: '+8801700000099',
    shares: 5,
    isEntrepreneur: false,
    depositMethod: 'BANK_DEPOSIT',
    depositDate: new Date(),
    ...overrides,
  };

  makeAuthMock(testStaff.authUserId);
  const investment = await registerInvestment(input, testStaff.id, { ipAddress: '127.0.0.1', userAgent: 'test' });
  return investment;
}

describe('Investment API Integration Tests', () => {
  beforeAll(async () => {
    const adapter = new PrismaPg({ connectionString: TEST_CONNECTION_STRING });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/investments (register)', () => {
    async function postRegister(body: unknown): Promise<Response> {
      const { POST } = await import('@/app/api/investments/route');
      return POST(makeRequest('http://localhost/api/investments', { method: 'POST', body: JSON.stringify(body) }));
    }

    const validBody = (overrides: Record<string, unknown> = {}) => ({
      name: 'New Investor',
      phone: '+8801800000001',
      shares: 7,
      isEntrepreneur: false,
      depositMethod: 'BANK_TRANSFER',
      depositDate: '2025-01-15T10:00:00.000Z',
      depositRef: 'TXN123456',
      notes: 'Test deposit',
      ...overrides,
    });

    it('a. Staff register success: 201, investment with derived fields + transaction + audit log', async () => {
      makeAuthMock(testStaff.authUserId);
      const response = await postRegister(validBody());
      expect(response.status).toBe(201);

      const body = await response.json();
      expect(body.uid).toMatch(/^NEO-\d{4,}$/);
      expect(body.code).toMatch(/^NB-[A-HJ-NP-Z2-9]{6}$/);
      expect(body.category).toBe('PREMIUM'); // 5-9 shares = PREMIUM
      expect(body.shares).toBe(7);
      expect(body.amount).toBe(calculateAmount(7, DEFAULT_SETTINGS.SHARE_PRICE));
      expect(body.incentiveAmount).toBe(0);
      expect(body.status).toBe('PENDING');

      const stored = await prisma.investment.findUniqueOrThrow({
        where: { uid: body.uid },
        include: { investor: true },
      });
      expect(stored.category).toBe('PREMIUM');
      expect(stored.sharePrice).toBe(DEFAULT_SETTINGS.SHARE_PRICE);
      expect(stored.incentivePerShare).toBe(DEFAULT_SETTINGS.INCENTIVE_PER_SHARE);
      expect(stored.amount).toBe(calculateAmount(7, DEFAULT_SETTINGS.SHARE_PRICE));
      expect(stored.incentiveAmount).toBe(0);
      expect(stored.status).toBe(InvestmentStatus.PENDING);
      expect(stored.recordedByStaffId).toBe(testStaff.id);
      expect(stored.investor.name).toBe('New Investor');

      const transactions = await prisma.transaction.findMany({
        where: { investmentId: stored.id },
      });
      expect(transactions).toHaveLength(1);
      expect(transactions[0].type).toBe(TransactionType.DEPOSIT);
      expect(transactions[0].amount).toBe(stored.amount);
      expect(transactions[0].recordedByStaffId).toBe(testStaff.id);
      expect(transactions[0].note).toBe('Initial deposit');

      const auditLogs = await prisma.auditLog.findMany({
        where: { targetId: stored.id, action: actionVerbs.investmentRegister },
      });
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].actorType).toBe(ActorType.STAFF);
      expect(auditLogs[0].actorId).toBe(testStaff.id);
      expect(auditLogs[0].targetType).toBe('Investment');
      expect(auditLogs[0].metadata).toMatchObject({
        uid: stored.uid,
        code: stored.code,
        investorId: stored.investorId,
        amount: stored.amount,
      });
    });

    it('client-supplied category/amount are rejected by the strict schema, never stored', async () => {
      makeAuthMock(testStaff.authUserId);
      // category/amount are deliberately wrong for 7 shares (PREMIUM, not SHAREHOLDER).
      const response = await postRegister(
        validBody({ phone: '+8801800000010', category: 'SHAREHOLDER', amount: 1 }),
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      // The register route returns the raw zod flatten() as `error` (unlike jsonError routes);
      // unrecognized keys from .strict() land in formErrors.
      expect(body.error?.formErrors?.length ?? 0).toBeGreaterThan(0);

      expect(await prisma.investment.count({ where: { investor: { phone: '+8801800000010' } } })).toBe(0);
    });

    it('b. Register rejected: entrepreneur flag with <10 shares -> 400, no rows written', async () => {
      makeAuthMock(testStaff.authUserId);
      const response = await postRegister(
        validBody({ phone: '+8801800000002', shares: 5, isEntrepreneur: true }),
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      // superRefine issue on path ['shares'] lands in fieldErrors.shares.
      expect(String(body.error?.fieldErrors?.shares ?? '')).toContain('Entrepreneur rule');
      expect(await prisma.investment.count({ where: { investor: { phone: '+8801800000002' } } })).toBe(0);
      expect(await prisma.transaction.count({
        where: { investment: { investor: { phone: '+8801800000002' } } },
      })).toBe(0);
    });

    it('c. Unauthenticated register -> 401, no rows written', async () => {
      makeAuthMock(null);
      const response = await postRegister(validBody({ phone: '+8801800000003' }));
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error?.code).toBe('AUTH_ERROR');

      expect(await prisma.investment.count({ where: { investor: { phone: '+8801800000003' } } })).toBe(0);
    });
  });

  describe('POST /api/investments/[id]/confirm (confirmInvestment)', () => {
    async function postConfirm(id: string): Promise<Response> {
      const { POST } = await import('@/app/api/investments/[id]/confirm/route');
      return POST(
        makeRequest(`http://localhost/api/investments/${id}/confirm`, { method: 'POST' }),
        { params: Promise.resolve({ id }) },
      );
    }

    beforeEach(async () => {
      // Create a fresh investment for each confirm test
      testInvestment = await createTestInvestment({
        name: 'Confirm Test Investor',
        phone: '+8801900000001',
        shares: 3,
        isEntrepreneur: false,
        depositMethod: 'BANK_DEPOSIT',
        depositDate: new Date(),
      });
      // Link the investment's investor to testInvestor for ownership tests
      await prisma.investment.update({
        where: { id: testInvestment.id },
        data: { investorId: testInvestor.id },
      });
    });

    it('d. Confirm by owning investor: 200, CONFIRMED, confirmedAt set, AuditLog written', async () => {
      makeAuthMock(testInvestor.authUserId);

      const response = await postConfirm(testInvestment.id);
      expect(response.status).toBe(200);
      expect((await response.json()).status).toBe('CONFIRMED');

      const stored = await prisma.investment.findUniqueOrThrow({ where: { id: testInvestment.id } });
      expect(stored.status).toBe(InvestmentStatus.CONFIRMED);
      expect(stored.confirmedAt).toBeInstanceOf(Date);
      expect(stored.confirmedByInvestorId).toBe(testInvestor.id);

      const auditLogs = await prisma.auditLog.findMany({
        where: { targetId: testInvestment.id, action: actionVerbs.investmentConfirm },
      });
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].actorType).toBe(ActorType.INVESTOR);
      expect(auditLogs[0].actorId).toBe(testInvestor.id);
    });

    it('e. Confirm by NON-owning investor: 403, status still PENDING, no AuditLog', async () => {
      makeAuthMock(testInvestor2.authUserId);

      const response = await postConfirm(testInvestment.id);
      expect(response.status).toBe(403);
      expect((await response.json()).error?.code).toBe('AUTH_ERROR');

      const stored = await prisma.investment.findUniqueOrThrow({ where: { id: testInvestment.id } });
      expect(stored.status).toBe(InvestmentStatus.PENDING);
      expect(stored.confirmedAt).toBeNull();
      expect(stored.confirmedByInvestorId).toBeNull();

      expect(await prisma.auditLog.count({
        where: { targetId: testInvestment.id, action: actionVerbs.investmentConfirm },
      })).toBe(0);
    });
  });

  describe('GET /api/investments/verify (public verify)', () => {
    let verifyInvestment: { id: string; uid: string; code: string; investorId: string };

    beforeAll(async () => {
      verifyInvestment = await createTestInvestment({
        name: 'Verify Test Investor',
        phone: '+8801900000002',
        shares: 8,
        isEntrepreneur: false,
        depositMethod: 'MOBILE_BANKING',
        depositDate: new Date('2025-02-01T10:00:00.000Z'),
      });
    });

    it('f. Public verify by code: returns investor name/shares/amount/category/status but NO NID, phone, email', async () => {
      const { GET } = await import('@/app/api/investments/verify/route');

      const request = makeRequest(
        `http://localhost/api/investments/verify?code=${verifyInvestment.code}`,
        { headers: { 'x-forwarded-for': '203.0.113.10' } }
      );

      const response = await GET(request);
      expect(response.status).toBe(200);

      const body = await response.json();

      // Assert returned fields
      expect(body.uid).toBe(verifyInvestment.uid);
      expect(body.code).toBe(verifyInvestment.code);
      expect(body.investorName).toBe('Verify Test Investor');
      expect(body.shares).toBe(8);
      expect(body.amount).toBe(calculateAmount(8, DEFAULT_SETTINGS.SHARE_PRICE));
      expect(body.category).toBe('PREMIUM');
      expect(body.status).toBe('PENDING');
      expect(body.depositDate).toBeDefined();

      // Assert sensitive fields are NOT present
      const jsonString = JSON.stringify(body);
      expect(jsonString).not.toContain('TEST-NID');
      expect(jsonString).not.toContain('phone');
      expect(jsonString).not.toContain('email');
      expect(jsonString).not.toContain('nationalIdNumber');
      expect(jsonString).not.toContain('nationalIdFileKey');
      expect(jsonString).not.toContain('depositSlipFileKey');
      expect(jsonString).not.toContain('notes');

      // Verify AuditLog lookup row was written
      const auditLogs = await prisma.auditLog.findMany({
        where: { action: actionVerbs.investmentVerifyLookup, targetId: verifyInvestment.uid },
      });
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].actorType).toBe(ActorType.PUBLIC);
      expect(auditLogs[0].ipAddress).toBe('203.0.113.10');
      expect(auditLogs[0].metadata).toMatchObject({ found: true });
    });

    it('g. Verify rate limit: pre-insert 20 audit logs for IP -> returns 429', async () => {
      const { GET } = await import('@/app/api/investments/verify/route');
      const testIp = '198.51.100.42';

      // Pre-insert 20 lookup audit logs for this IP within the 5-minute window
      for (let i = 0; i < 20; i++) {
        await writeAuditLog({
          actorType: ActorType.PUBLIC,
          actorId: null,
          action: actionVerbs.investmentVerifyLookup,
          targetType: 'Investment',
          targetId: `dummy-${i}`,
          ipAddress: testIp,
          userAgent: 'rate-limit-test',
          metadata: { found: true },
        });
      }

      const request = makeRequest(
        `http://localhost/api/investments/verify?code=${verifyInvestment.code}`,
        { headers: { 'x-forwarded-for': testIp } }
      );

      const response = await GET(request);
      expect(response.status).toBe(429);

      const body = await response.json();
      expect(body.error?.code).toBe('RATE_LIMITED');
    });
  });

  describe('RLS Cross-tenant denial', () => {
    let investorA: { id: string; authUserId: string | null; phone: string };
    let investorB: { id: string; authUserId: string | null; phone: string };

    beforeAll(async () => {
      // Create two separate investors
      investorA = await prisma.investor.create({
        data: {
          authUserId: 'investor-a-auth',
          phone: '+8801500000001',
          name: 'Investor A',
        },
        select: { id: true, authUserId: true, phone: true },
      });

      investorB = await prisma.investor.create({
        data: {
          authUserId: 'investor-b-auth',
          phone: '+8801500000002',
          name: 'Investor B',
        },
        select: { id: true, authUserId: true, phone: true },
      });

      // Create one investment per investor (rows must exist for the policy join;
      // the assertions below query by investorId, not by investment id)
      await prisma.investment.create({
        data: {
          investorId: investorA.id,
          uid: formatUid(99901),
          uidSequence: 99901,
          code: generateVerificationCode(),
          shares: 5,
          category: 'PREMIUM',
          isEntrepreneur: false,
          incentiveAmount: 0,
          sharePrice: DEFAULT_SETTINGS.SHARE_PRICE,
          incentivePerShare: DEFAULT_SETTINGS.INCENTIVE_PER_SHARE,
          amount: calculateAmount(5, DEFAULT_SETTINGS.SHARE_PRICE),
          depositMethod: 'BANK_DEPOSIT',
          depositDate: new Date(),
          recordedByStaffId: testStaff.id,
        },
        select: { id: true, investorId: true },
      });

      await prisma.investment.create({
        data: {
          investorId: investorB.id,
          uid: formatUid(99902),
          uidSequence: 99902,
          code: generateVerificationCode(),
          shares: 3,
          category: 'SHAREHOLDER',
          isEntrepreneur: false,
          incentiveAmount: 0,
          sharePrice: DEFAULT_SETTINGS.SHARE_PRICE,
          incentivePerShare: DEFAULT_SETTINGS.INCENTIVE_PER_SHARE,
          amount: calculateAmount(3, DEFAULT_SETTINGS.SHARE_PRICE),
          depositMethod: 'BANK_DEPOSIT',
          depositDate: new Date(),
          recordedByStaffId: testStaff.id,
        },
        select: { id: true, investorId: true },
      });
    });

    it('h. RLS cross-tenant denial: authenticated as investor A cannot select investor B investments', async () => {
      // Use raw SQL to test RLS with SET LOCAL role and request.jwt.claims
      // We need to run this in a transaction to use SET LOCAL
      const result = await prisma.$transaction(async (tx) => {
        // Set role to authenticated and set the JWT claims for investor A
        await tx.$executeRaw`SET LOCAL ROLE authenticated`;
        await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: investorA.authUserId })}, true)`;

        // Try to select investor B's investment - should return 0 rows due to RLS
        const rows = await tx.$queryRaw<{ id: string; uid: string; investorId: string }[]>`
          SELECT id, uid, "investorId" FROM "Investment" WHERE "investorId" = ${investorB.id}
        `;

        return rows;
      });

      expect(result).toHaveLength(0);

      // Confirm investor A CAN select their own row under the same role/claims
      const ownResult = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL ROLE authenticated`;
        await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: investorA.authUserId })}, true)`;

        const rows = await tx.$queryRaw<{ id: string; uid: string; investorId: string }[]>`
          SELECT id, uid, "investorId" FROM "Investment" WHERE "investorId" = ${investorA.id}
        `;

        return rows;
      });

      expect(ownResult).toHaveLength(1);
      expect(ownResult[0].investorId).toBe(investorA.id);
    });
  });

  describe('Investment Request Lifecycle', () => {
    let testInvestor3: { id: string; authUserId: string | null; phone: string };

    beforeAll(async () => {
      // Create a dedicated investor for request lifecycle tests
      testInvestor3 = await prisma.investor.create({
        data: {
          authUserId: 'test-investor-auth-003',
          phone: '+8801700000003',
          name: 'Request Lifecycle Investor',
          email: 'investor3@test.com',
        },
        select: { id: true, authUserId: true, phone: true },
      });
    });

    beforeEach(async () => {
      // Clean up between tests for this investor
      await prisma.transaction.deleteMany({ where: { investment: { investorId: testInvestor3?.id } } });
      await prisma.investment.deleteMany({ where: { investorId: testInvestor3?.id } });
      await prisma.investmentRequest.deleteMany({ where: { investorId: testInvestor3?.id } });
    });

    afterAll(async () => {
      // Clean up in dependency order: transactions -> investments -> requests -> investor
      await prisma.transaction.deleteMany({ where: { investment: { investorId: testInvestor3?.id } } });
      await prisma.investment.deleteMany({ where: { investorId: testInvestor3?.id } });
      await prisma.investmentRequest.deleteMany({ where: { investorId: testInvestor3?.id } });
      await prisma.investor.deleteMany({ where: { id: testInvestor3?.id } });
    });

    async function submitRequest(overrides: Partial<{
      shares: number;
      entrepreneurRequested: boolean;
      depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING';
      depositRef: string | null;
      depositDate: Date;
      note: string | null;
    }> = {}) {
      makeAuthMock(testInvestor3.authUserId);
      const input = {
        investorId: testInvestor3.id,
        shares: 5,
        entrepreneurRequested: false,
        depositMethod: 'BANK_DEPOSIT' as const,
        depositRef: 'TXN123456',
        depositDate: new Date(),
        note: 'Test request',
        ...overrides,
      };
      return await submitInvestmentRequest(input, { ipAddress: '127.0.0.1', userAgent: 'test' });
    }

    it('submit → approve-unchanged yields CONFIRMED investment linked to request', async () => {
      const request = await submitRequest({ shares: 3, entrepreneurRequested: false });
      expect(request.status).toBe(InvestmentRequestStatus.SUBMITTED);

      makeAuthMock(testStaff.authUserId);
      const approved = await approveInvestmentRequest(
        { requestId: request.id, staffId: testStaff.id },
        { ipAddress: '127.0.0.1', userAgent: 'test' },
      );

      expect(approved.status).toBe(InvestmentRequestStatus.APPROVED);
      expect(approved.investmentId).not.toBeNull();

      const investmentId = approved.investmentId!;
      const investment = await prisma.investment.findUniqueOrThrow({ where: { id: investmentId } });
      expect(investment.status).toBe(InvestmentStatus.CONFIRMED);
      expect(investment.confirmedAt).not.toBeNull();
      expect(investment.confirmedByInvestorId).toBe(testInvestor3.id);

      // Verify the request links back to this investment
      const updatedRequest = await prisma.investmentRequest.findUniqueOrThrow({ where: { id: request.id } });
      expect(updatedRequest.investmentId).toBe(investmentId);
    });

    it('submit → approve-modified yields PENDING investment', async () => {
      const request = await submitRequest({ shares: 3, entrepreneurRequested: false });

      makeAuthMock(testStaff.authUserId);
      const approved = await approveInvestmentRequest(
        { requestId: request.id, staffId: testStaff.id, shares: 10, isEntrepreneur: true },
        { ipAddress: '127.0.0.1', userAgent: 'test' },
      );

      expect(approved.status).toBe(InvestmentRequestStatus.APPROVED);
      expect(approved.investmentId).not.toBeNull();

      const investmentId = approved.investmentId!;
      const investment = await prisma.investment.findUniqueOrThrow({ where: { id: investmentId } });
      expect(investment.status).toBe(InvestmentStatus.PENDING);
      expect(investment.confirmedAt).toBeNull();
      expect(investment.confirmedByInvestorId).toBeNull();
      expect(investment.shares).toBe(10);
      expect(investment.isEntrepreneur).toBe(true);
    });

    it('submit → reject stores the reason and creates NO investment', async () => {
      const request = await submitRequest({ shares: 2 });

      makeAuthMock(testStaff.authUserId);
      const rejected = await rejectInvestmentRequest(
        { requestId: request.id, staffId: testStaff.id, reviewNote: 'Insufficient documentation' },
        { ipAddress: '127.0.0.1', userAgent: 'test' },
      );

      expect(rejected.status).toBe('REJECTED');
      expect(rejected.reviewNote).toBe('Insufficient documentation');
      expect(rejected.investmentId).toBeNull();

      const investmentCount = await prisma.investment.count({ where: { investorId: testInvestor3.id } });
      expect(investmentCount).toBe(0);
    });

    it('approving twice fails and does not create a second investment', async () => {
      const request = await submitRequest({ shares: 4 });

      makeAuthMock(testStaff.authUserId);
      // First approve
      await approveInvestmentRequest(
        { requestId: request.id, staffId: testStaff.id },
        { ipAddress: '127.0.0.1', userAgent: 'test' },
      );

      // Second approve should fail
      let error: Error | null = null;
      try {
        await approveInvestmentRequest(
          { requestId: request.id, staffId: testStaff.id },
          { ipAddress: '127.0.0.1', userAgent: 'test' },
        );
      } catch (e) {
        error = e as Error;
      }
      expect(error).not.toBeNull();
      expect(error!.message).toContain('not in SUBMITTED status');

      // Only one investment should exist
      const investmentCount = await prisma.investment.count({ where: { investorId: testInvestor3.id } });
      expect(investmentCount).toBe(1);
    });
  });

  describe('Concurrency and Business Logic Edge Cases', () => {
    let testInvestor4: { id: string; authUserId: string | null; phone: string };

    beforeAll(async () => {
      testInvestor4 = await prisma.investor.create({
        data: {
          authUserId: 'test-investor-auth-004',
          phone: '+8801700000004',
          name: 'Concurrency Test Investor',
          email: 'investor4@test.com',
        },
        select: { id: true, authUserId: true, phone: true },
      });
    });

    beforeEach(async () => {
      await prisma.transaction.deleteMany({ where: { investment: { investorId: testInvestor4?.id } } });
      await prisma.investment.deleteMany({ where: { investorId: testInvestor4?.id } });
      await prisma.investmentRequest.deleteMany({ where: { investorId: testInvestor4?.id } });
    });

    afterAll(async () => {
      await prisma.transaction.deleteMany({ where: { investment: { investorId: testInvestor4?.id } } });
      await prisma.investment.deleteMany({ where: { investorId: testInvestor4?.id } });
      await prisma.investmentRequest.deleteMany({ where: { investorId: testInvestor4?.id } });
      await prisma.investor.deleteMany({ where: { id: testInvestor4?.id } });
    });

    async function submitRequest4(overrides: Partial<{
      shares: number;
      entrepreneurRequested: boolean;
      depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING';
      depositRef: string | null;
      depositDate: Date;
      note: string | null;
    }> = {}) {
      const input = {
        investorId: testInvestor4.id,
        shares: 5,
        entrepreneurRequested: false,
        depositMethod: 'BANK_DEPOSIT' as const,
        depositRef: 'TXN123456',
        depositDate: new Date(),
        note: 'Concurrency test',
        ...overrides,
      };
      return await submitInvestmentRequest(input, { ipAddress: '127.0.0.1', userAgent: 'test' });
    }

    it('i. Concurrent approve: exactly one succeeds, one Investment + one DEPOSIT Transaction', async () => {
      const request = await submitRequest4({ shares: 3, entrepreneurRequested: false });

      // Fire two concurrent approvals
      const results = await Promise.allSettled([
        approveInvestmentRequest({ requestId: request.id, staffId: testStaff.id }, { ipAddress: '127.0.0.1', userAgent: 'test' }),
        approveInvestmentRequest({ requestId: request.id, staffId: testStaff.id }, { ipAddress: '127.0.0.1', userAgent: 'test' }),
      ]);

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      // Exactly one should succeed, one should fail
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('not in SUBMITTED status');

      // Exactly ONE Investment and ONE DEPOSIT Transaction for that request
      const investments = await prisma.investment.findMany({ where: { investorId: testInvestor4.id } });
      expect(investments).toHaveLength(1);
      expect(investments[0].status).toBe(InvestmentStatus.CONFIRMED);

      const transactions = await prisma.transaction.findMany({
        where: { investmentId: investments[0].id, type: TransactionType.DEPOSIT },
      });
      expect(transactions).toHaveLength(1);

      // Request has exactly one investmentId
      const updatedRequest = await prisma.investmentRequest.findUniqueOrThrow({ where: { id: request.id } });
      expect(updatedRequest.investmentId).toBe(investments[0].id);
    });

    it('j. Concurrent reject: exactly one succeeds, no Investment created', async () => {
      const request = await submitRequest4({ shares: 4 });

      // Fire two concurrent rejects
      const results = await Promise.allSettled([
        rejectInvestmentRequest({ requestId: request.id, staffId: testStaff.id, reviewNote: 'Reject 1' }, { ipAddress: '127.0.0.1', userAgent: 'test' }),
        rejectInvestmentRequest({ requestId: request.id, staffId: testStaff.id, reviewNote: 'Reject 2' }, { ipAddress: '127.0.0.1', userAgent: 'test' }),
      ]);

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      // Exactly one should succeed, one should fail
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('not in SUBMITTED status');

      // Request should be REJECTED, no Investment created
      const updatedRequest = await prisma.investmentRequest.findUniqueOrThrow({ where: { id: request.id } });
      expect(updatedRequest.status).toBe(InvestmentRequestStatus.REJECTED);
      expect(updatedRequest.investmentId).toBeNull();

      const investmentCount = await prisma.investment.count({ where: { investorId: testInvestor4.id } });
      expect(investmentCount).toBe(0);
    });

    it('k. Approve vs Reject race: exactly one wins, correct state', async () => {
      const request = await submitRequest4({ shares: 5 });

      // Fire approve and reject concurrently
      const results = await Promise.allSettled([
        approveInvestmentRequest({ requestId: request.id, staffId: testStaff.id }, { ipAddress: '127.0.0.1', userAgent: 'test' }),
        rejectInvestmentRequest({ requestId: request.id, staffId: testStaff.id, reviewNote: 'Rejected' }, { ipAddress: '127.0.0.1', userAgent: 'test' }),
      ]);

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      // Exactly one should succeed, one should fail
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('not in SUBMITTED status');

      // Check final state: either approved with Investment, or rejected with no Investment
      const updatedRequest = await prisma.investmentRequest.findUniqueOrThrow({ where: { id: request.id } });
      const investments = await prisma.investment.findMany({ where: { investorId: testInvestor4.id } });

      if (updatedRequest.status === InvestmentRequestStatus.APPROVED) {
        expect(updatedRequest.investmentId).not.toBeNull();
        expect(investments).toHaveLength(1);
        expect(investments[0].status).toBe(InvestmentStatus.CONFIRMED);

        const transactions = await prisma.transaction.findMany({
          where: { investmentId: investments[0].id, type: TransactionType.DEPOSIT },
        });
        expect(transactions).toHaveLength(1);
      } else {
        expect(updatedRequest.status).toBe(InvestmentRequestStatus.REJECTED);
        expect(updatedRequest.investmentId).toBeNull();
        expect(investments).toHaveLength(0);
      }
    });

    it('l. Entrepreneur revocation: request with entrepreneurRequested=true, approve with isEntrepreneur=false -> incentiveAmount=0', async () => {
      const request = await submitRequest4({ shares: 10, entrepreneurRequested: true });

      makeAuthMock(testStaff.authUserId);
      const approved = await approveInvestmentRequest(
        { requestId: request.id, staffId: testStaff.id, isEntrepreneur: false },
        { ipAddress: '127.0.0.1', userAgent: 'test' },
      );

      expect(approved.status).toBe(InvestmentRequestStatus.APPROVED);
      expect(approved.investmentId).not.toBeNull();

      const investment = await prisma.investment.findUniqueOrThrow({ where: { id: approved.investmentId! } });
      expect(investment.isEntrepreneur).toBe(false);
      expect(investment.incentiveAmount).toBe(0);
      expect(investment.shares).toBe(10);
    });

    it('m. Deposit ref normalization: request with depositRef null, approve with depositRef "" -> Investment CONFIRMED, depositRef null', async () => {
      const request = await submitRequest4({ shares: 3, depositRef: null });

      makeAuthMock(testStaff.authUserId);
      const approved = await approveInvestmentRequest(
        { requestId: request.id, staffId: testStaff.id, depositRef: '' },
        { ipAddress: '127.0.0.1', userAgent: 'test' },
      );

      expect(approved.status).toBe(InvestmentRequestStatus.APPROVED);
      expect(approved.investmentId).not.toBeNull();

      const investment = await prisma.investment.findUniqueOrThrow({ where: { id: approved.investmentId! } });
      expect(investment.status).toBe(InvestmentStatus.CONFIRMED);
      expect(investment.depositRef).toBeNull();
    });

    it('n. Deposit ref normalization with whitespace: request with depositRef null, approve with depositRef "   " -> Investment CONFIRMED, depositRef null', async () => {
      const request = await submitRequest4({ shares: 3, depositRef: null });

      makeAuthMock(testStaff.authUserId);
      const approved = await approveInvestmentRequest(
        { requestId: request.id, staffId: testStaff.id, depositRef: '   ' },
        { ipAddress: '127.0.0.1', userAgent: 'test' },
      );

      expect(approved.status).toBe(InvestmentRequestStatus.APPROVED);
      expect(approved.investmentId).not.toBeNull();

      const investment = await prisma.investment.findUniqueOrThrow({ where: { id: approved.investmentId! } });
      expect(investment.status).toBe(InvestmentStatus.CONFIRMED);
      expect(investment.depositRef).toBeNull();
    });
  });
});