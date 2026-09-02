import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';
import { Prisma, type OwnAuthRole, type OtpPurpose } from '@/lib/generated/prisma/client';
import { hashPassword } from './password';
import { generateOtp, generateSessionToken, hashOtp, hashSessionToken } from './otp';

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const SESSION_DEFAULT_TTL_HOURS = 24;

export type CreateAuthUserResult =
  | { ok: true; user: { id: string; email: string; role: OwnAuthRole } }
  | { ok: false; error: 'emailTaken' };

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// timingSafeEqual throws on unequal buffer lengths; guard so any malformed
// stored hash degrades to "no match" instead of throwing.
function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function createAuthUser(
  email: string,
  password: string,
  role: OwnAuthRole,
): Promise<CreateAuthUserResult> {
  try {
    const user = await prisma.authUser.create({
      data: {
        email: email.toLowerCase(),
        passwordHash: await hashPassword(password),
        role,
      },
      select: { id: true, email: true, role: true },
    });
    return { ok: true, user };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: 'emailTaken' };
    }
    throw error;
  }
}

export async function findAuthUserByEmail(email: string) {
  return prisma.authUser.findUnique({
    where: { email: email.toLowerCase() },
  });
}

export interface CreateSessionOptions {
  userAgent?: string | null;
  ip?: string | null;
  ttlHours?: number;
}

export async function createSession(userId: string, options: CreateSessionOptions = {}): Promise<string> {
  const { userAgent, ip, ttlHours = SESSION_DEFAULT_TTL_HOURS } = options;
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  await prisma.authSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: userAgent ?? null,
      ip: ip ?? null,
    },
  });
  return token;
}

export async function getSessionUser(token: string) {
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt <= new Date()) return null;
  return session.user;
}

export async function revokeSession(token: string): Promise<void> {
  await prisma.authSession.updateMany({
    where: { tokenHash: hashSessionToken(token) },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await prisma.authSession.updateMany({
    where: { userId },
    data: { revokedAt: new Date() },
  });
}

export async function issueOtp(email: string, purpose: OtpPurpose): Promise<string> {
  const emailLower = email.toLowerCase();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60_000);
  const code = generateOtp();

  await prisma.$transaction(async (tx) => {
    // Invalidate any prior unconsumed OTP for this email+purpose.
    await tx.emailOtp.updateMany({
      where: { email: emailLower, purpose, consumedAt: null },
      data: { consumedAt: now },
    });
    await tx.emailOtp.create({
      data: {
        email: emailLower,
        purpose,
        codeHash: hashOtp(code),
        expiresAt,
        attempts: 0,
      },
    });
  });

  return code;
}

export async function verifyOtp(email: string, purpose: OtpPurpose, code: string): Promise<boolean> {
  const emailLower = email.toLowerCase();
  const now = new Date();

  // Newest unconsumed, unexpired OTP for this email+purpose only.
  const otp = await prisma.emailOtp.findFirst({
    where: { email: emailLower, purpose, consumedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) return false;

  const inputHash = hashOtp(code);
  const withinAttempts = otp.attempts < OTP_MAX_ATTEMPTS;
  const match = withinAttempts && safeEqualHex(inputHash, otp.codeHash);

  // Always persist attempt accounting so the DB round-trip is constant-ish
  // regardless of whether the code matched.
  await prisma.emailOtp.update({
    where: { id: otp.id },
    data: {
      attempts: { increment: 1 },
      ...(match ? { consumedAt: now } : {}),
    },
  });

  return match;
}
