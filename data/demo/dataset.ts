/**
 * THE demo dataset — static, in-repo, zero-database presentation data.
 * Ported from prisma/seed-demo.ts so the two tell the same story:
 * demo investor Rahim Uddin (40 confirmed + 20 pending shares), three
 * walk-in shareholders, one pending payment report, three interest leads.
 *
 * Everything here is shaped exactly like the Prisma rows the real query
 * layer returns, so data/demo/store.ts can serve it without adapters.
 * Money stays integer BDT per the project money rules.
 */

export const DEMO_SETTINGS = {
  SHARE_PRICE: 200000,
  INCENTIVE_PER_SHARE: 0,
  TARGET_AMOUNT: 1800000000,
  TARGET_SHARES: 15000,
  FOUNDING_AMOUNT: 100000000,
  FOUNDING_SHARES: 50,
  TARGET_ENTREPRENEURS: 50,
  FULL_PAYMENT_DISCOUNT_PER_SHARE: 10000,
  INSTALLMENT_UNIT_AMOUNT: 50000,
  INSTALLMENT_COUNT: 4,
} as const;

export type DemoInvestor = {
  id: string;
  authUserId: string | null;
  phone: string;
  name: string;
  email: string | null;
  nationalIdNumber: string | null;
  tin?: string | null;
  address?: string | null;
  approvalStatus: 'PENDING' | 'APPROVED';
  createdAt: Date;
  updatedAt: Date;
};

export const DEMO_INVESTORS: DemoInvestor[] = [
  { id: 'demo-investor-rahim', authUserId: 'demo-auth-investor', phone: '+8801790000001', name: 'Rahim Uddin', email: 'rahim.uddin@example.com', nationalIdNumber: '1990123456789', approvalStatus: 'APPROVED', createdAt: new Date('2026-08-10T09:00:00Z'), updatedAt: new Date('2026-08-20T09:00:00Z') },
  { id: 'demo-investor-kamrul', authUserId: null, phone: '+8801811000100', name: 'Kamrul Hasan', email: 'kamrul.hasan@example.com', nationalIdNumber: '1985111222333', approvalStatus: 'APPROVED', createdAt: new Date('2026-08-12T09:00:00Z'), updatedAt: new Date('2026-08-12T09:00:00Z') },
  { id: 'demo-investor-nusrat', authUserId: null, phone: '+8801933000200', name: 'Nusrat Jahan', email: 'nusrat.jahan@example.com', nationalIdNumber: '1992033444555', approvalStatus: 'APPROVED', createdAt: new Date('2026-08-14T09:00:00Z'), updatedAt: new Date('2026-08-14T09:00:00Z') },
  { id: 'demo-investor-shahana', authUserId: null, phone: '+8801712000300', name: 'Shahana Akter', email: null, nationalIdNumber: '1979555666777', approvalStatus: 'APPROVED', createdAt: new Date('2026-08-18T09:00:00Z'), updatedAt: new Date('2026-08-18T09:00:00Z') },
  // Second demo login identity: the kisti (installment) investor. The 179…
  // prefix follows the same no-collision rule as the other demo identities.
  { id: 'demo-investor-sultana', authUserId: 'demo-auth-investor-kisti', phone: '+8801790000003', name: 'Sultana Begum', email: 'sultana.begum@example.com', nationalIdNumber: '1995777888999', approvalStatus: 'APPROVED', createdAt: new Date('2026-08-24T09:00:00Z'), updatedAt: new Date('2026-08-24T09:00:00Z') },
];

export type DemoStaff = {
  id: string;
  authUserId: string;
  name: string;
  email: string | null;
  role: 'ADMIN' | 'FINANCE';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export const DEMO_STAFF: DemoStaff[] = [
  { id: 'demo-staff-admin', authUserId: 'demo-auth-admin', name: 'Demo Admin', email: 'demo-admin@neobee.test', role: 'ADMIN', isActive: true, createdAt: new Date('2026-08-01T09:00:00Z'), updatedAt: new Date('2026-08-01T09:00:00Z') },
];

export type DemoInvestment = {
  id: string;
  investorId: string;
  uid: string;
  code: string;
  shares: number;
  category: 'SHAREHOLDER' | 'PREMIUM' | 'DIRECTOR';
  isEntrepreneur: boolean;
  incentiveAmount: number;
  sharePrice: number;
  incentivePerShare: number;
  discountPerShare?: number; // FULL-plan one-time-payment discount snapshot; 0/omitted for INSTALLMENT.
  amount: number;
  paymentPlan?: 'FULL' | 'INSTALLMENT';
  fullyPaidAt?: Date | null; // set when the plan total is reached (FULL: on approval; INSTALLMENT: last kisti clears).
  certificateIssuedAt?: Date | null; // certificate exists only for fully-paid investments.
  depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING';
  depositRef: string | null;
  depositDate: Date;
  status: 'PENDING' | 'CONFIRMED';
  confirmedAt: Date | null;
  notes: string | null;
  recordedByStaffId: string;
  createdAt: Date;
  updatedAt: Date;
};

// Kisti schedule rows (kisti 1–4 per installment-plan investment).
export type DemoSchedule = {
  id: string;
  investmentId: string;
  installmentNo: number;
  dueDate: Date;
  amount: number;
  status: 'SCHEDULED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
};

const KISTI_UNIT = DEMO_SETTINGS.INSTALLMENT_UNIT_AMOUNT;
const KISTI_DEADLINES = ['2026-08-31', '2026-12-31', '2027-06-30', '2027-12-31'] as const;

const SHARE_PRICE = DEMO_SETTINGS.SHARE_PRICE;
const INCENTIVE = DEMO_SETTINGS.INCENTIVE_PER_SHARE;

export const DEMO_INVESTMENTS: DemoInvestment[] = [
  // Fully-paid investor story: Rahim's confirmed holdings carry certificates.
  { id: 'demo-inv-9001', investorId: 'demo-investor-rahim', uid: 'NEO-9001', code: 'NB-DEMQRT', shares: 40, category: 'DIRECTOR', isEntrepreneur: false, incentiveAmount: 0, sharePrice: SHARE_PRICE, incentivePerShare: INCENTIVE, discountPerShare: 10000, amount: 7600000, paymentPlan: 'FULL', fullyPaidAt: new Date('2026-08-22T10:00:00Z'), certificateIssuedAt: new Date('2026-08-22T10:00:00Z'), depositMethod: 'BANK_TRANSFER', depositRef: 'TRX-DEMO-0001', depositDate: new Date('2026-08-20T10:00:00Z'), status: 'CONFIRMED', confirmedAt: new Date('2026-08-22T10:00:00Z'), notes: 'Paid in full at once (৳10,000 discount per share applied)', recordedByStaffId: 'demo-staff-admin', createdAt: new Date('2026-08-20T10:00:00Z'), updatedAt: new Date('2026-08-22T10:00:00Z') },
  { id: 'demo-inv-9002', investorId: 'demo-investor-rahim', uid: 'NEO-9002', code: 'NB-DEMKMX', shares: 20, category: 'PREMIUM', isEntrepreneur: false, incentiveAmount: 0, sharePrice: SHARE_PRICE, incentivePerShare: INCENTIVE, discountPerShare: 10000, amount: 3800000, paymentPlan: 'FULL', fullyPaidAt: new Date('2026-08-26T10:00:00Z'), certificateIssuedAt: new Date('2026-08-26T10:00:00Z'), depositMethod: 'MOBILE_BANKING', depositRef: 'BKX-DEMO-2244', depositDate: new Date('2026-08-24T10:00:00Z'), status: 'CONFIRMED', confirmedAt: new Date('2026-08-26T10:00:00Z'), notes: 'Paid in full at once (৳10,000 discount per share applied)', recordedByStaffId: 'demo-staff-admin', createdAt: new Date('2026-08-24T10:00:00Z'), updatedAt: new Date('2026-08-26T10:00:00Z') },
  { id: 'demo-inv-9011', investorId: 'demo-investor-kamrul', uid: 'NEO-9011', code: 'NB-DEMXYZ', shares: 100, category: 'DIRECTOR', isEntrepreneur: true, incentiveAmount: 2000000, sharePrice: SHARE_PRICE, incentivePerShare: INCENTIVE, discountPerShare: 10000, amount: 19000000, paymentPlan: 'FULL', fullyPaidAt: new Date('2026-08-13T10:00:00Z'), certificateIssuedAt: new Date('2026-08-13T10:00:00Z'), depositMethod: 'BANK_DEPOSIT', depositRef: 'DEP-DEMO-3311', depositDate: new Date('2026-08-12T10:00:00Z'), status: 'CONFIRMED', confirmedAt: new Date('2026-08-13T10:00:00Z'), notes: 'Demo seeded shareholder', recordedByStaffId: 'demo-staff-admin', createdAt: new Date('2026-08-12T10:00:00Z'), updatedAt: new Date('2026-08-13T10:00:00Z') },
  { id: 'demo-inv-9012', investorId: 'demo-investor-nusrat', uid: 'NEO-9012', code: 'NB-DEMWZP', shares: 25, category: 'PREMIUM', isEntrepreneur: false, incentiveAmount: 0, sharePrice: SHARE_PRICE, incentivePerShare: INCENTIVE, discountPerShare: 10000, amount: 4750000, paymentPlan: 'FULL', fullyPaidAt: new Date('2026-08-15T10:00:00Z'), certificateIssuedAt: new Date('2026-08-15T10:00:00Z'), depositMethod: 'BANK_TRANSFER', depositRef: 'TRX-DEMO-4422', depositDate: new Date('2026-08-14T10:00:00Z'), status: 'CONFIRMED', confirmedAt: new Date('2026-08-15T10:00:00Z'), notes: 'Demo seeded shareholder', recordedByStaffId: 'demo-staff-admin', createdAt: new Date('2026-08-14T10:00:00Z'), updatedAt: new Date('2026-08-15T10:00:00Z') },
  { id: 'demo-inv-9013', investorId: 'demo-investor-shahana', uid: 'NEO-9013', code: 'NB-DEMPRN', shares: 5, category: 'SHAREHOLDER', isEntrepreneur: false, incentiveAmount: 0, sharePrice: SHARE_PRICE, incentivePerShare: INCENTIVE, amount: 1000000, paymentPlan: 'FULL', fullyPaidAt: null, certificateIssuedAt: null, depositMethod: 'CHEQUE', depositRef: 'CHQ-DEMO-5533', depositDate: new Date('2026-08-18T10:00:00Z'), status: 'PENDING', confirmedAt: null, notes: 'Demo seeded shareholder', recordedByStaffId: 'demo-staff-admin', createdAt: new Date('2026-08-18T10:00:00Z'), updatedAt: new Date('2026-08-18T10:00:00Z') },
  // Kisti investor story: 1 share on the installment plan — kisti 1 paid,
  // kisti 2 in the approval queue, kistis 3–4 scheduled. Total due ৳2,00,000;
  // paid to date ৳50,000.
  { id: 'demo-inv-9014', investorId: 'demo-investor-sultana', uid: 'NEO-9014', code: 'NB-DEMSBK', shares: 1, category: 'SHAREHOLDER', isEntrepreneur: false, incentiveAmount: 0, sharePrice: SHARE_PRICE, incentivePerShare: INCENTIVE, amount: 50000, paymentPlan: 'INSTALLMENT', fullyPaidAt: null, certificateIssuedAt: null, depositMethod: 'MOBILE_BANKING', depositRef: 'BKX-DEMO-9014', depositDate: new Date('2026-08-24T10:00:00Z'), status: 'CONFIRMED', confirmedAt: new Date('2026-08-25T10:00:00Z'), notes: 'Kisti plan: 4 × ৳50,000 — kisti 1 paid, kisti 2 reported', recordedByStaffId: 'demo-staff-admin', createdAt: new Date('2026-08-24T10:00:00Z'), updatedAt: new Date('2026-08-30T10:00:00Z') },
];

export const DEMO_SCHEDULES: DemoSchedule[] = [
  { id: 'demo-sched-9014-1', investmentId: 'demo-inv-9014', installmentNo: 1, dueDate: new Date(`${KISTI_DEADLINES[0]}T00:00:00Z`), amount: KISTI_UNIT, status: 'PAID' },
  { id: 'demo-sched-9014-2', investmentId: 'demo-inv-9014', installmentNo: 2, dueDate: new Date(`${KISTI_DEADLINES[1]}T00:00:00Z`), amount: KISTI_UNIT, status: 'SCHEDULED' },
  { id: 'demo-sched-9014-3', investmentId: 'demo-inv-9014', installmentNo: 3, dueDate: new Date(`${KISTI_DEADLINES[2]}T00:00:00Z`), amount: KISTI_UNIT, status: 'SCHEDULED' },
  { id: 'demo-sched-9014-4', investmentId: 'demo-inv-9014', installmentNo: 4, dueDate: new Date(`${KISTI_DEADLINES[3]}T00:00:00Z`), amount: KISTI_UNIT, status: 'SCHEDULED' },
];

export type DemoTransaction = {
  id: string;
  investmentId: string;
  amount: number;
  type: 'DEPOSIT' | 'REFUND' | 'CORRECTION' | 'DISTRIBUTION';
  depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING' | null;
  depositDate: Date | null;
  note: string | null;
  recordedByStaffId: string;
  createdAt: Date;
};

export const DEMO_TRANSACTIONS: DemoTransaction[] = [
  ...DEMO_INVESTMENTS.filter((inv) => inv.status === 'CONFIRMED').map((inv, i) => ({
    id: `demo-tx-${i + 1}`,
    investmentId: inv.id,
    amount: inv.amount,
    type: 'DEPOSIT' as const,
    depositMethod: inv.depositMethod,
    depositDate: inv.depositDate,
    note: inv.paymentPlan === 'INSTALLMENT' ? `Kisti 1 of 4 (৳${KISTI_UNIT.toLocaleString('en-IN')} per kisti)` : 'Demo seeded deposit ledger row',
    recordedByStaffId: 'demo-staff-admin',
    createdAt: inv.createdAt,
  })),
  // Kisti 1 ledger row for Sultana's installment plan (matches demo-sched-9014-1).
  {
    id: 'demo-tx-kisti-1',
    investmentId: 'demo-inv-9014',
    amount: KISTI_UNIT,
    type: 'DEPOSIT' as const,
    depositMethod: 'MOBILE_BANKING' as const,
    depositDate: new Date('2026-08-24T10:00:00Z'),
    note: 'Kisti 1 of 4 — bKash payment BKX-DEMO-9014',
    recordedByStaffId: 'demo-staff-admin',
    createdAt: new Date('2026-08-25T10:00:00Z'),
  },
];

export type DemoInvestmentRequest = {
  id: string;
  investorId: string;
  kind: 'SHARE_PURCHASE' | 'PAYMENT';
  targetInvestmentId: string | null;
  installmentNo?: number | null; // PAYMENT only: which kisti (1–4) this claim targets
  shares: number;
  entrepreneurRequested: boolean;
  sharePrice: number;
  incentivePerShare: number;
  amount: number;
  depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING';
  depositRef: string | null;
  depositDate: Date;
  note: string | null;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  reviewedByStaffId: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  investmentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const DEMO_REQUESTS: DemoInvestmentRequest[] = [
  { id: 'demo-req-pay-1', investorId: 'demo-investor-rahim', kind: 'PAYMENT', targetInvestmentId: 'demo-inv-9001', shares: 0, entrepreneurRequested: false, sharePrice: SHARE_PRICE, incentivePerShare: INCENTIVE, amount: 500000, depositMethod: 'MOBILE_BANKING', depositRef: 'BKX-DEMO-7788', depositDate: new Date('2026-08-26T10:00:00Z'), note: 'Installment no. 2 paid via bKash — reference BKX-DEMO-7788', status: 'SUBMITTED', reviewedByStaffId: null, reviewedAt: null, reviewNote: null, investmentId: null, createdAt: new Date('2026-08-26T10:00:00Z'), updatedAt: new Date('2026-08-26T10:00:00Z') },
  // Sultana's kisti-2 payment report: in the queue so staff can approve it live.
  { id: 'demo-req-kisti-2', investorId: 'demo-investor-sultana', kind: 'PAYMENT', targetInvestmentId: 'demo-inv-9014', installmentNo: 2, shares: 0, entrepreneurRequested: false, sharePrice: SHARE_PRICE, incentivePerShare: INCENTIVE, amount: KISTI_UNIT, depositMethod: 'MOBILE_BANKING', depositRef: 'BKX-DEMO-9015', depositDate: new Date('2026-08-30T10:00:00Z'), note: 'Kisti 2 of 4 paid via bKash — reference BKX-DEMO-9015', status: 'SUBMITTED', reviewedByStaffId: null, reviewedAt: null, reviewNote: null, investmentId: null, createdAt: new Date('2026-08-30T10:00:00Z'), updatedAt: new Date('2026-08-30T10:00:00Z') },
];

export type DemoLead = {
  id: string;
  ref: string;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  status: 'NEW' | 'CONTACTED';
  contactedAt: Date | null;
  contactedByStaffId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const DEMO_LEADS: DemoLead[] = [
  { id: 'demo-lead-1', ref: 'NB-LEAD-DEMO', name: 'Sabbir Ahmed', phone: '+8801811000111', email: 'sabbir.ahmed@example.com', message: 'Want to visit the site office and discuss founding-entrepreneur entry.', status: 'NEW', contactedAt: null, contactedByStaffId: null, createdAt: new Date('2026-08-27T11:00:00Z'), updatedAt: new Date('2026-08-27T11:00:00Z') },
  { id: 'demo-lead-2', ref: 'NB-LEAD-K9LM', name: 'Farhana Yasmin', phone: '+8801933000222', email: 'farhana.y@example.com', message: 'Interested in a 5-share premium entry. Please call after 5pm.', status: 'NEW', contactedAt: null, contactedByStaffId: null, createdAt: new Date('2026-08-27T15:00:00Z'), updatedAt: new Date('2026-08-27T15:00:00Z') },
  { id: 'demo-lead-3', ref: 'NB-LEAD-QRTV', name: 'Mahbub Alam', phone: '+8801712000333', email: null, message: null, status: 'CONTACTED', contactedAt: new Date('2026-08-27T09:30:00Z'), contactedByStaffId: 'demo-staff-admin', createdAt: new Date('2026-08-25T09:00:00Z'), updatedAt: new Date('2026-08-27T09:30:00Z') },
];
