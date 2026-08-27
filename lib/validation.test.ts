import { describe, it, expect } from 'vitest';
import {
  normalizeBangladeshiPhone,
  registerInvestmentSchema,
  listInvestmentsSchema,
  verifyQuerySchema,
} from './validation';
import { MIN_SHARES, MAX_SHARES, ENTREPRENEUR_MIN_SHARES } from './money';

describe('normalizeBangladeshiPhone', () => {
  it('keeps a correctly formatted number unchanged', () => {
    expect(normalizeBangladeshiPhone('+8801712345678')).toBe('+8801712345678');
  });

  it('adds the country code to a number starting with 01', () => {
    expect(normalizeBangladeshiPhone('01987654321')).toBe('+8801987654321');
  });

  it.each([
    '1712345678',
    '+880171234567',
    '017123456789',
    'garbage',
    '',
    ' ',
  ])('throws on invalid phone format %s', (phone) => {
    expect(() => normalizeBangladeshiPhone(phone)).toThrow('Invalid Bangladeshi phone number');
  });
});

describe('registerInvestmentSchema', () => {
  const validPayload = {
    name: 'Test User',
    phone: '01712345678',
    shares: 5,
    depositMethod: 'BANK_TRANSFER',
    depositDate: new Date(),
  } as const;

  it('parses a valid payload', () => {
    const result = registerInvestmentSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe('+8801712345678');
      expect(result.data.isEntrepreneur).toBe(false);
    }
  });

  it.each([
    [0, false],
    [MIN_SHARES - 1, false],
    [MAX_SHARES + 1, false],
    [2.5, false],
  ])('rejects invalid shares: %s', (shares) => {
    const result = registerInvestmentSchema.safeParse({ ...validPayload, shares });
    expect(result.success).toBe(false);
  });

  it('accepts entrepreneur flag at the minimum share count', () => {
    const result = registerInvestmentSchema.safeParse({ ...validPayload, shares: ENTREPRENEUR_MIN_SHARES, isEntrepreneur: true });
    expect(result.success).toBe(true);
  });

  it('rejects entrepreneur flag below the minimum share count', () => {
    const result = registerInvestmentSchema.safeParse({ ...validPayload, shares: ENTREPRENEUR_MIN_SHARES - 1, isEntrepreneur: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.shares).toBeDefined();
    }
  });

  it('accepts non-entrepreneur below the minimum share count', () => {
    const result = registerInvestmentSchema.safeParse({ ...validPayload, shares: ENTREPRENEUR_MIN_SHARES - 1, isEntrepreneur: false });
    expect(result.success).toBe(true);
  });

  it('rejects a future deposit date', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    const result = registerInvestmentSchema.safeParse({ ...validPayload, depositDate: futureDate });
    expect(result.success).toBe(false);
  });

  it('accepts a past deposit date', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const result = registerInvestmentSchema.safeParse({ ...validPayload, depositDate: pastDate });
    expect(result.success).toBe(true);
  });

  it.each(['category', 'amount', 'uid', 'code'])('rejects unknown key %s', (key) => {
    const result = registerInvestmentSchema.safeParse({ ...validPayload, [key]: 'test' });
    expect(result.success).toBe(false);
  });
});

describe('listInvestmentsSchema', () => {
  it('applies defaults for empty query', () => {
    const result = listInvestmentsSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
  });

  it('coerces and clamps page sizes', () => {
    expect(listInvestmentsSchema.parse({ pageSize: '101' }).pageSize).toBe(100);
    expect(listInvestmentsSchema.parse({ pageSize: '0' }).pageSize).toBe(1);
  });
});

describe('verifyQuerySchema', () => {
  it('accepts a valid code', () => {
    expect(verifyQuerySchema.safeParse({ code: 'NB-ABCDEF' }).success).toBe(true);
  });

  it('accepts a valid uid', () => {
    expect(verifyQuerySchema.safeParse({ uid: 'NEO-1234' }).success).toBe(true);
  });

  it.each([
    { code: 'NB-ABCDEF', uid: 'NEO-1234' },
    {},
  ])('rejects when both or neither are provided', (query) => {
    expect(verifyQuerySchema.safeParse(query).success).toBe(false);
  });

  it.each([
    'NB-ABCDE', // too short
    'NB-ABCDEFG', // too long
    'NB-ABCDEI', // contains I
    'NB-ABCDE0', // contains 0
  ])('rejects malformed code %s', (code) => {
    expect(verifyQuerySchema.safeParse({ code }).success).toBe(false);
  });
});
