import { randomInt as nodeRandomInt } from 'node:crypto';

export const DEFAULT_SETTINGS = Object.freeze({
  SHARE_PRICE: 200000,
  INCENTIVE_PER_SHARE: 20000,
  TARGET_AMOUNT: 3000000000,
  TARGET_SHARES: 15000,
  FOUNDING_AMOUNT: 100000000,
  TARGET_ENTREPRENEURS: 50,
} as const);

export type SettingKey = keyof typeof DEFAULT_SETTINGS;

export const ENTREPRENEUR_MIN_SHARES = 10;
export const MIN_SHARES = 1;
export const MAX_SHARES = 100;
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const UID_PREFIX = 'NEO-';
export const CODE_PREFIX = 'NB-';
export const UID_PAD = 4;

export const InvestmentCategory = Object.freeze({
  SHAREHOLDER: 'SHAREHOLDER',
  PREMIUM: 'PREMIUM',
  DIRECTOR: 'DIRECTOR',
} as const);

export type InvestmentCategory =
  (typeof InvestmentCategory)[keyof typeof InvestmentCategory];

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function numberToWords(x: number): string {
  if (x < 20) {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    return ones[x];
  }
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  if (x < 100) {
    return tens[Math.floor(x / 10)] + (x % 10 ? ` ${numberToWords(x % 10)}` : '');
  }
  if (x < 1000) {
    return `${numberToWords(Math.floor(x / 100))} hundred${x % 100 ? ' ' : ''}${x % 100 ? numberToWords(x % 100) : ''}`;
  }
  return `${numberToWords(Math.floor(x / 1000))} thousand${x % 1000 ? ' ' : ''}${x % 1000 ? numberToWords(x % 1000) : ''}`;
}

export function deriveCategory(shares: number): InvestmentCategory {
  assertPositiveInteger(shares, 'shares');
  if (shares >= 10) return InvestmentCategory.DIRECTOR;
  if (shares >= 5) return InvestmentCategory.PREMIUM;
  return InvestmentCategory.SHAREHOLDER;
}

export function calculateAmount(shares: number, sharePrice: number): number {
  assertPositiveInteger(shares, 'shares');
  assertPositiveInteger(sharePrice, 'sharePrice');
  const amount = shares * sharePrice;
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError('amount exceeds Number.MAX_SAFE_INTEGER');
  }
  return amount;
}

export function calculateIncentive(shares: number, isEntrepreneur: boolean, incentivePerShare: number): number {
  assertPositiveInteger(shares, 'shares');
  assertPositiveInteger(incentivePerShare, 'incentivePerShare');
  // Validation-layer concern; see assertEntrepreneurEligible.
  return isEntrepreneur ? calculateAmount(shares, incentivePerShare) : 0;
}

export function assertEntrepreneurEligible(shares: number, isEntrepreneur: boolean): void {
  assertPositiveInteger(shares, 'shares');
  if (isEntrepreneur && shares < ENTREPRENEUR_MIN_SHARES) {
    // The prototype wrongly allowed the flag at any share count.
    throw new RangeError(`Entrepreneur requires at least ${ENTREPRENEUR_MIN_SHARES} shares`);
  }
}

export function formatUid(sequence: number): string {
  assertPositiveInteger(sequence, 'sequence');
  // Sequence must come from a Postgres sequence, never from a row count.
  return `${UID_PREFIX}${String(sequence).padStart(UID_PAD, '0')}`;
}

export function generateVerificationCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[nodeRandomInt(CODE_ALPHABET.length)];
  }
  // Uniqueness is enforced by a database unique constraint with retry-on-conflict.
  return `${CODE_PREFIX}${code}`;
}

export function amountInWords(amount: number): string {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError('amount must be a non-negative integer');
  }
  if (amount === 0) return 'zero';
  let n = amount;
  const out: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thou = Math.floor(n / 1000);
  n %= 1000;
  if (crore) out.push(`${numberToWords(crore)} crore`);
  if (lakh) out.push(`${numberToWords(lakh)} lakh`);
  if (thou) out.push(`${numberToWords(thou)} thousand`);
  if (n) out.push(numberToWords(n));
  const s = out.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatBdt(amount: number): string {
  if (!Number.isInteger(amount)) {
    throw new RangeError('amount must be an integer');
  }
  // Negative ledger amounts are intentional for refunds and distributions.
  return amount.toLocaleString('en-IN');
}
