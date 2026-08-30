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
  INCENTIVE_PER_SHARE: 20000,
  TARGET_AMOUNT: 3000000000,
  TARGET_SHARES: 15000,
  FOUNDING_AMOUNT: 100000000,
  FOUNDING_SHARES: 50,
  TARGET_ENTREPRENEURS: 50,
} as const;

export type DemoInvestor = {
  id: string;
  authUserId: string | null;
  phone: string;
  name: string;
  email: string | null;
  nationalIdNumber: string | null;
  approvalStatus: 'PENDING' | 'APPROVED';
  createdAt: Date;
  updatedAt: Date;
};

export const DEMO_INVESTORS: DemoInvestor[] = [
  { id: 'demo-investor-rahim', authUserId: 'demo-auth-investor', phone: '+8801790000001', name: 'Rahim Uddin', email: 'rahim.uddin@example.com', nationalIdNumber: '1990123456789', approvalStatus: 'APPROVED', createdAt: new Date('2026-08-10T09:00:00Z'), updatedAt: new Date('2026-08-20T09:00:00Z') },
  { id: 'demo-investor-kamrul', authUserId: null, phone: '+8801811000100', name: 'Kamrul Hasan', email: 'kamrul.hasan@example.com', nationalIdNumber: '1985111222333', approvalStatus: 'APPROVED', createdAt: new Date('2026-08-12T09:00:00Z'), updatedAt: new Date('2026-08-12T09:00:00Z') },
  { id: 'demo-investor-nusrat', authUserId: null, phone: '+8801933000200', name: 'Nusrat Jahan', email: 'nusrat.jahan@example.com', nationalIdNumber: '1992033444555', approvalStatus: 'APPROVED', createdAt: new Date('2026-08-14T09:00:00Z'), updatedAt: new Date('2026-08-14T09:00:00Z') },
  { id: 'demo-investor-shahana', authUserId: null, phone: '+8801712000300', name: 'Shahana Akter', email: null, nationalIdNumber: '1979555666777', approvalStatus: 'APPROVED', createdAt: new Date('2026-08-18T09:00:00Z'), updatedAt: new Date('2026-08-18T09:00:00Z') },
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
  amount: number;
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

const SHARE_PRICE = DEMO_SETTINGS.SHARE_PRICE;
const INCENTIVE = DEMO_SETTINGS.INCENTIVE_PER_SHARE;

export const DEMO_INVESTMENTS: DemoInvestment[] = [
  { id: 'demo-inv-9001', investorId: 'demo-investor-rahim', uid: 'NEO-9001', code: 'NB-DEMQR', shares: 40, category: 'DIRECTOR', isEntrepreneur: false, incentiveAmount: 0, sharePrice: SHARE_PRICE, incentivePerShare: INCENTIVE, amount: 8000000, depositMethod: 'BANK_TRANSFER', depositRef: 'TRX-DEMO-0001', depositDate: new Date('2026-08-20T10:00:00Z'), status: 'CONFIRMED', confirmedAt: new Date('2026-08-22T10:00:00Z'), notes: 'Demo seeded shareholder', recordedByStaffId: 'demo-staff-admin', createdAt: new Date('2026-08-20T10:00:00Z'), updatedAt: new Date('2026-08-22T10:00:00Z') },
  { id: 'demo-inv-9002', investorId: 'demo-investor-rahim', uid: 'NEO-9002', code: 'NB-DEMKM', shares: 20, category: 'PREMIUM', isEntrepreneur: false, incentiveAmount: 0, sharePrice: SHARE_PRICE, incentivePerShare: INCENTIVE, amount: 4000000, depositMethod: 'MOBILE_BANKING', depositRef: 'BKX-DEMO-2244', depositDate: new Date('2026-08-24T10:00:00Z'), status: 'PENDING', confirmedAt: null, notes: 'Demo seeded shareholder', recordedByStaffId: 'demo-staff-admin', createdAt: new Date('2026-08-24T10:00:00Z'), updatedAt: new Date('2026-08-24T10:00:00Z') },
  { id: 'demo-inv-9011', investorId: 'demo-investor-kamrul', uid: 'NEO-9011', code: 'NB-DEMXY', shares: 100, category: 'DIRECTOR', isEntrepreneur: true, incentiveAmount: 2000000, sharePrice: SHARE_PRICE, incentivePerShare: INCENTIVE, amount: 20000000, depositMethod: 'BANK_DEPOSIT', depositRef: 'DEP-DEMO-3311', depositDate: new Date('2026-08-12T10:00:00Z'), status: 'CONFIRMED', confirmedAt: new Date('2026-08-13T10:00:00Z'), notes: 'Demo seeded shareholder', recordedByStaffId: 'demo-staff-admin', createdAt: new Date('2026-08-12T10:00:00Z'), updatedAt: new Date('2026-08-13T10:00:00Z') },
  { id: 'demo-inv-9012', investorId: 'demo-investor-nusrat', uid: 'NEO-9012', code: 'NB-DEMWZ', shares: 25, category: 'PREMIUM', isEntrepreneur: false, incentiveAmount: 0, sharePrice: SHARE_PRICE, incentivePerShare: INCENTIVE, amount: 5000000, depositMethod: 'BANK_TRANSFER', depositRef: 'TRX-DEMO-4422', depositDate: new Date('2026-08-14T10:00:00Z'), status: 'CONFIRMED', confirmedAt: new Date('2026-08-15T10:00:00Z'), notes: 'Demo seeded shareholder', recordedByStaffId: 'demo-staff-admin', createdAt: new Date('2026-08-14T10:00:00Z'), updatedAt: new Date('2026-08-15T10:00:00Z') },
  { id: 'demo-inv-9013', investorId: 'demo-investor-shahana', uid: 'NEO-9013', code: 'NB-DEMPN', shares: 5, category: 'SHAREHOLDER', isEntrepreneur: false, incentiveAmount: 0, sharePrice: SHARE_PRICE, incentivePerShare: INCENTIVE, amount: 1000000, depositMethod: 'CHEQUE', depositRef: 'CHQ-DEMO-5533', depositDate: new Date('2026-08-18T10:00:00Z'), status: 'PENDING', confirmedAt: null, notes: 'Demo seeded shareholder', recordedByStaffId: 'demo-staff-admin', createdAt: new Date('2026-08-18T10:00:00Z'), updatedAt: new Date('2026-08-18T10:00:00Z') },
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

export const DEMO_TRANSACTIONS: DemoTransaction[] = DEMO_INVESTMENTS.map((inv, i) => ({
  id: `demo-tx-${i + 1}`,
  investmentId: inv.id,
  amount: inv.amount,
  type: 'DEPOSIT' as const,
  depositMethod: inv.depositMethod,
  depositDate: inv.depositDate,
  note: 'Demo seeded deposit ledger row',
  recordedByStaffId: 'demo-staff-admin',
  createdAt: inv.createdAt,
}));

export type DemoInvestmentRequest = {
  id: string;
  investorId: string;
  kind: 'SHARE_PURCHASE' | 'PAYMENT';
  targetInvestmentId: string | null;
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
