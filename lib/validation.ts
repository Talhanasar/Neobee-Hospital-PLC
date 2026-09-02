import { z } from 'zod';
import { ENTREPRENEUR_MIN_SHARES, MAX_SHARES, MIN_SHARES, canPayByInstallment } from '@/lib/money';

export const SLIP_MAX_BYTES = 5 * 1024 * 1024; // 5 MB per deposit slip upload.
export const SLIP_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

export function normalizeBangladeshiPhone(phone: string): string {
  const value = phone.trim();
  if (/^\+8801\d{9}$/.test(value)) {
    return value;
  }
  if (/^01\d{9}$/.test(value)) {
    return `+880${value.slice(1)}`;
  }
  throw new Error('Invalid Bangladeshi phone number');
}

const phoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    try {
      return normalizeBangladeshiPhone(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid Bangladeshi mobile number' });
      return z.NEVER;
    }
  });

const dateSchema = z.coerce.date().refine((date) => date.getTime() <= Date.now() + 24 * 60 * 60 * 1000, {
  message: 'depositDate cannot be more than 1 day in the future',
});

export const registerInvestmentSchema = z
  .object({
    name: z.string().trim().min(1, { message: 'Name is required' }).max(200),
    phone: phoneSchema,
    email: z.email().optional(),
    nationalIdNumber: z.string().trim().max(50).optional(),
    shares: z.number().int().min(MIN_SHARES).max(MAX_SHARES),
    isEntrepreneur: z.boolean().default(false),
    depositMethod: z.enum(['BANK_DEPOSIT', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_BANKING']),
    depositRef: z.string().trim().max(100).optional(),
    depositDate: dateSchema,
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.isEntrepreneur && value.shares < ENTREPRENEUR_MIN_SHARES) {
      ctx.addIssue({
        code: 'custom',
        path: ['shares'],
        message: `Entrepreneur rule: isEntrepreneur true requires at least ${ENTREPRENEUR_MIN_SHARES} shares`,
      });
    }
  });

export const listInvestmentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.preprocess((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return value;
    return Math.min(100, Math.max(1, Math.trunc(numeric)));
  }, z.number().int().min(1).max(100).default(25)),
  status: z.enum(['PENDING', 'CONFIRMED']).optional(),
  category: z.enum(['SHAREHOLDER', 'PREMIUM', 'DIRECTOR', 'GOLDEN_DIRECTOR']).optional(),
  search: z.string().trim().max(200).optional(),
});

export const verifyQuerySchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^NB-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
      .optional(),
    uid: z.string().trim().regex(/^NEO-\d{4,}$/).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.code ? 1 : 0) + (value.uid ? 1 : 0) !== 1) {
      ctx.addIssue({ code: 'custom', message: 'Provide exactly one of code or uid' });
    }
  });

export const submitInvestmentRequestSchema = z
  .object({
    shares: z.coerce.number().int().min(MIN_SHARES).max(MAX_SHARES),
    entrepreneurRequested: z.boolean().default(false),
    depositMethod: z.enum(['BANK_DEPOSIT', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_BANKING']),
    depositRef: z.string().trim().max(100).transform((v) => (v === '' ? null : v)).nullish(),
    depositDate: dateSchema,
    note: z.string().trim().max(2000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.entrepreneurRequested && value.shares < ENTREPRENEUR_MIN_SHARES) {
      ctx.addIssue({
        code: 'custom',
        path: ['shares'],
        message: `Entrepreneur rule: entrepreneurRequested true requires at least ${ENTREPRENEUR_MIN_SHARES} shares`,
      });
    }
  });

export const reviewInvestmentRequestSchema = z
  .object({
    shares: z.coerce.number().int().min(MIN_SHARES).max(MAX_SHARES).optional(),
    isEntrepreneur: z.boolean().optional(),
    depositMethod: z.enum(['BANK_DEPOSIT', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_BANKING']).optional(),
    depositRef: z.string().trim().max(100).transform((v) => (v === '' ? null : v)).nullish(),
    depositDate: dateSchema.optional(),
    reviewNote: z.string().trim().max(2000).optional(),
  })
  .strict();

export const rejectInvestmentRequestSchema = z
  .object({
    reviewNote: z.string().trim().min(1, { message: 'Review note is required' }).max(2000),
  })
  .strict();

// Email is deliberately absent: it is the Supabase Auth identity (OTP login,
// password reset) and must never diverge from the Investor row. Phone and TIN
// are editable from the account form; phone stays @unique in the Investor model
// (the action enforces the duplicate-phone rule explicitly).
export const createInvestorProfileSchema = z
  .object({
    name: z.string().trim().min(1, { message: 'Name is required' }).max(200),
    phone: phoneSchema,
    nationalIdNumber: z
      .string()
      .trim()
      .min(1, { message: 'NID / passport number is required' })
      .max(50),
    address: z.string().trim().max(500).optional(),
    tin: z
      .string()
      .trim()
      .regex(/^[0-9A-Za-z\-]{0,20}$/, { message: 'TIN must be ≤20 letters/digits/hyphens' })
      .optional(),
  })
  .strict();

// Registration profile completion. Email is the auth identity (verified via
// the emailed OTP); the deposit phone is claimed here and links the record —
// so the action pairs it with the NID as a knowledge check against records
// staff created. Kept separate from createInvestorProfileSchema, which the
// account-details form uses with no phone field.
export const completeRegistrationSchema = z
  .object({
    name: z.string().trim().min(1, { message: 'Name is required' }).max(200),
    email: z.email({ message: 'A valid email is required' }),
    phone: z
      .string()
      .trim()
      .transform((v, ctx) => {
        try {
          return normalizeBangladeshiPhone(v);
        } catch {
          ctx.addIssue({ code: 'custom', message: 'Enter a valid Bangladeshi mobile number' });
          return z.NEVER;
        }
      }),
    nationalIdNumber: z
      .string()
      .trim()
      .min(1, { message: 'NID / passport number is required' })
      .max(50),
  })
  .strict();

// Investor self-registration wizard: personal details + share subscription +
// deposit proof, submitted together after the email OTP check. The share
// amount is recomputed server-side from settings — the client's displayed
// amount is never trusted.
export const investorSignupSchema = z
  .object({
    name: z.string().trim().min(1, { message: 'Name is required' }).max(200),
    phone: phoneSchema,
    email: z.email({ message: 'A valid email is required' }),
    address: z.string().trim().max(500).optional(),
    nationalIdNumber: z.string().trim().min(1, { message: 'NID / passport number is required' }).max(50),
    password: z.string().min(6, { message: 'Password must be at least 6 characters' }).max(72),
    shares: z.coerce.number().int().min(MIN_SHARES).max(MAX_SHARES),
    paymentPlan: z.enum(['FULL', 'INSTALLMENT']),
    depositMethod: z.enum(['BANK_DEPOSIT', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_BANKING']),
    depositRef: z.string().trim().max(100).transform((v) => (v === '' ? null : v)).nullish(),
    depositDate: dateSchema,
    note: z.string().trim().max(2000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.paymentPlan === 'INSTALLMENT' && !canPayByInstallment(value.shares)) {
      ctx.addIssue({
        code: 'custom',
        path: ['paymentPlan'],
        message: 'Installment (kisti) payment is only available for exactly 1 share',
      });
    }
  });
export type InvestorSignupInput = z.infer<typeof investorSignupSchema>;

// The slip File travels via FormData, not JSON — validated alongside the schema.
export function validateSlipFile(file: File): string | null {
  if (file.size === 0) return 'Deposit slip image is required';
  if (file.size > SLIP_MAX_BYTES) return 'Deposit slip must be 5 MB or smaller';
  if (!SLIP_ALLOWED_TYPES.includes(file.type as (typeof SLIP_ALLOWED_TYPES)[number])) {
    return 'Deposit slip must be a JPG, PNG, WebP, or PDF file';
  }
  return null;
}

export const submitLeadSchema = z
  .object({
    name: z.string().trim().min(1, { message: 'Name is required' }).max(200),
    phone: phoneSchema,
    email: z.email().optional(),
    message: z.string().trim().max(2000).optional(),
  })
  .strict();

export type SubmitLeadInput = z.infer<typeof submitLeadSchema>;

export const submitPaymentRequestSchema = z
  .object({
    targetInvestmentId: z.string().min(1, { message: 'Choose the investment this payment belongs to' }),
    amount: z.coerce.number().int().min(1, { message: 'Amount must be at least ৳1' }),
    installmentNo: z.coerce.number().int().min(1).max(4).optional(),
    depositMethod: z.enum(['BANK_DEPOSIT', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_BANKING']),
    depositRef: z.string().trim().max(100).transform((v) => (v === '' ? null : v)).nullish(),
    depositDate: dateSchema,
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    password: z.string().min(6, { message: 'Password must be at least 6 characters' }).max(72),
    confirmPassword: z.string(),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export type SubmitPaymentRequestInput = z.infer<typeof submitPaymentRequestSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RegisterInvestmentInput = z.infer<typeof registerInvestmentSchema>;
export type ListInvestmentsInput = z.infer<typeof listInvestmentsSchema>;
export type VerifyQueryInput = z.infer<typeof verifyQuerySchema>;
export type SubmitInvestmentRequestInput = z.infer<typeof submitInvestmentRequestSchema>;
export type ReviewInvestmentRequestInput = z.infer<typeof reviewInvestmentRequestSchema>;
export type RejectInvestmentRequestInput = z.infer<typeof rejectInvestmentRequestSchema>;
export type CreateInvestorProfileInput = z.infer<typeof createInvestorProfileSchema>;
export type CompleteRegistrationInput = z.infer<typeof completeRegistrationSchema>;
export type { InvestmentCategory } from '@/lib/money';
