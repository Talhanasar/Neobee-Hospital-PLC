import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  INSTALLMENT_DEADLINES,
  assertEntrepreneurEligible,
  amountInWords,
  calculateAmount,
  calculateFullPaymentAmount,
  calculateIncentive,
  canPayByInstallment,
  certRef,
  deriveCategory,
  formatBdt,
  formatUid,
  fullPaymentPerShare,
  generateVerificationCode,
  installmentPerKisti,
  InvestmentCategory,
  kistiRef,
} from './money';

describe('DEFAULT_SETTINGS', () => {
  it('is frozen and matches the seeded defaults', () => {
    expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(true);
    expect(DEFAULT_SETTINGS).toEqual({
      SHARE_PRICE: 200000,
      INCENTIVE_PER_SHARE: 0,
      TARGET_AMOUNT: 1800000000,
      TARGET_SHARES: 15000,
      FOUNDING_AMOUNT: 100000000,
      TARGET_ENTREPRENEURS: 50,
      FULL_PAYMENT_DISCOUNT_PER_SHARE: 0,
      INSTALLMENT_UNIT_AMOUNT: 50000,
      INSTALLMENT_COUNT: 4,
    });
  });
});

describe('deriveCategory', () => {
  it('uses the documented thresholds', () => {
    expect(deriveCategory(1)).toBe(InvestmentCategory.SHAREHOLDER);
    expect(deriveCategory(4)).toBe(InvestmentCategory.SHAREHOLDER);
    expect(deriveCategory(5)).toBe(InvestmentCategory.PREMIUM);
    expect(deriveCategory(9)).toBe(InvestmentCategory.PREMIUM);
    expect(deriveCategory(10)).toBe(InvestmentCategory.DIRECTOR);
    expect(deriveCategory(11)).toBe(InvestmentCategory.DIRECTOR);
    expect(deriveCategory(24)).toBe(InvestmentCategory.DIRECTOR);
    expect(deriveCategory(25)).toBe(InvestmentCategory.GOLDEN_DIRECTOR);
    expect(deriveCategory(30)).toBe(InvestmentCategory.GOLDEN_DIRECTOR);
    expect(deriveCategory(500)).toBe(InvestmentCategory.GOLDEN_DIRECTOR);
  });

  it('rejects invalid share counts', () => {
    for (const value of [0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => deriveCategory(value)).toThrow(RangeError);
    }
  });
});

describe('calculateAmount', () => {
  it('uses the supplied price', () => {
    expect(calculateAmount(1, DEFAULT_SETTINGS.SHARE_PRICE)).toBe(200000);
    expect(calculateAmount(10, DEFAULT_SETTINGS.SHARE_PRICE)).toBe(2000000);
    expect(calculateAmount(2, 250000)).toBe(500000);
  });

  it('rejects invalid inputs', () => {
    for (const value of [0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => calculateAmount(value, DEFAULT_SETTINGS.SHARE_PRICE)).toThrow(RangeError);
      expect(() => calculateAmount(1, value)).toThrow(RangeError);
    }
  });

  it('rejects overflow', () => {
    expect(() => calculateAmount(Number.MAX_SAFE_INTEGER, 2)).toThrow(RangeError);
  });
});

describe('calculateIncentive', () => {
  it('returns zero when the entrepreneur flag is false', () => {
    expect(calculateIncentive(10, false, 20000)).toBe(0);
    expect(calculateIncentive(3, false, 60000)).toBe(0);
  });

  it('uses the supplied incentive rate', () => {
    expect(calculateIncentive(10, true, 20000)).toBe(200000);
    expect(calculateIncentive(10, true, 60000)).toBe(600000);
  });

  it('rejects invalid inputs', () => {
    for (const value of [0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => calculateIncentive(value, true, DEFAULT_SETTINGS.INCENTIVE_PER_SHARE)).toThrow(RangeError);
      expect(() => calculateIncentive(10, true, value)).toThrow(RangeError);
    }
  });

  it('does not enforce the 10-share rule itself', () => {
    expect(calculateIncentive(3, true, 20000)).toBe(60000);
  });
});

describe('assertEntrepreneurEligible', () => {
  it('rejects entrepreneur flag below 10 shares', () => {
    expect(() => assertEntrepreneurEligible(9, true)).toThrow(RangeError);
  });

  it('rejects invalid shares', () => {
    for (const value of [0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => assertEntrepreneurEligible(value, true)).toThrow(RangeError);
    }
  });

  it('allows exactly 10 shares', () => {
    expect(() => assertEntrepreneurEligible(10, true)).not.toThrow();
  });

  it('allows non-entrepreneur investors below 10 shares', () => {
    expect(() => assertEntrepreneurEligible(9, false)).not.toThrow();
  });
});

describe('formatUid', () => {
  it('pads to at least four digits', () => {
    expect(formatUid(1)).toBe('NEO-0001');
    expect(formatUid(42)).toBe('NEO-0042');
    expect(formatUid(9999)).toBe('NEO-9999');
    expect(formatUid(10000)).toBe('NEO-10000');
    expect(formatUid(123456)).toBe('NEO-123456');
  });

  it('rejects invalid sequences', () => {
    expect(() => formatUid(0)).toThrow(RangeError);
    expect(() => formatUid(1.2)).toThrow(RangeError);
  });
});

describe('generateVerificationCode', () => {
  it('uses the required alphabet and prefix', () => {
    const code = generateVerificationCode();
    expect(code).toMatch(/^NB-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(code).toHaveLength(9);
  });

  it('produces varied codes with the real RNG', () => {
    const codes = new Set<string>();
    const disallowed = new Set(['I', 'O', '0', '1']);
    for (let i = 0; i < 500; i += 1) {
      const code = generateVerificationCode();
      expect(code).toMatch(/^NB-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
      expect(code).toHaveLength(9);
      expect(code.includes('I')).toBe(false);
      expect(code.includes('O')).toBe(false);
      expect(code.includes('0')).toBe(false);
      expect(code.includes('1')).toBe(false);
      expect(code.trim()).toBe(code);
      expect(code).not.toContain('  ');
      for (const char of code) {
        expect(disallowed.has(char)).toBe(false);
      }
      codes.add(code);
    }
    expect(codes.size).toBeGreaterThanOrEqual(2);
  });
});

describe('amountInWords', () => {
  it('formats values in the Bangladeshi numbering system', () => {
    expect(amountInWords(0)).toBe('zero');
    expect(amountInWords(200000)).toBe('Two lakh');
    expect(amountInWords(2000000)).toBe('Twenty lakh');
    expect(amountInWords(100000000)).toBe('Ten crore');
    expect(amountInWords(3000000000)).toBe('Three hundred crore');
    expect(amountInWords(1000000000)).toBe('One hundred crore');
    expect(amountInWords(10000000000)).toBe('One thousand crore');
    expect(amountInWords(12345678)).toBe('One crore twenty three lakh forty five thousand six hundred seventy eight');
    expect(amountInWords(1234)).toBe('One thousand two hundred thirty four');
    expect(amountInWords(1)).toBe('One');
  });

  it('handles rollover cases without malformed output', () => {
    for (const value of [999, 99999, 9999999, 10000007, 100000001]) {
      const words = amountInWords(value);
      expect(words).not.toContain('undefined');
      expect(words).not.toContain('  ');
      expect(words.trim()).toBe(words);
    }
  });

  it('rejects invalid amounts', () => {
    for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => amountInWords(value)).toThrow(RangeError);
    }
  });
});

describe('formatBdt', () => {
  it('uses Indian digit grouping', () => {
    expect(formatBdt(200000)).toBe('2,00,000');
    expect(formatBdt(3000000000)).toBe('3,00,00,00,000');
    expect(formatBdt(-200000)).toBe('-2,00,000');
    expect(formatBdt(0)).toBe('0');
  });

  it('rejects non-integer inputs', () => {
    for (const value of [2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => formatBdt(value)).toThrow(RangeError);
    }
  });
});

describe('canPayByInstallment', () => {
  it('allows exactly one share', () => {
    expect(canPayByInstallment(1)).toBe(true);
  });

  it('rejects multi-share and invalid counts', () => {
    expect(canPayByInstallment(2)).toBe(false);
    expect(canPayByInstallment(10)).toBe(false);
    for (const value of [0, -1, 1.5, Number.NaN]) {
      expect(() => canPayByInstallment(value)).toThrow(RangeError);
    }
  });
});

describe('fullPaymentPerShare', () => {
  it('subtracts the discount', () => {
    expect(fullPaymentPerShare(200000, 10000)).toBe(190000);
    expect(fullPaymentPerShare(200000, 0)).toBe(200000);
  });

  it('rejects invalid discounts', () => {
    expect(() => fullPaymentPerShare(200000, -1)).toThrow(RangeError);
    expect(() => fullPaymentPerShare(200000, 200000)).toThrow(RangeError);
    expect(() => fullPaymentPerShare(200000, 1.5)).toThrow(RangeError);
  });
});

describe('calculateFullPaymentAmount', () => {
  it('applies the discount across all shares', () => {
    expect(calculateFullPaymentAmount(1, 200000, 10000)).toBe(190000);
    expect(calculateFullPaymentAmount(3, 200000, 10000)).toBe(570000);
    expect(calculateFullPaymentAmount(2, 200000, 0)).toBe(400000);
  });
});

describe('installmentPerKisti', () => {
  it('multiplies shares by the unit amount', () => {
    expect(installmentPerKisti(1, 50000)).toBe(50000);
    expect(installmentPerKisti(2, 50000)).toBe(100000);
  });
});

describe('INSTALLMENT_DEADLINES', () => {
  it('has four ascending deadlines', () => {
    expect(INSTALLMENT_DEADLINES).toHaveLength(4);
    const dates = [...INSTALLMENT_DEADLINES].map((d) => new Date(d).getTime());
    for (let i = 1; i < dates.length; i += 1) {
      expect(dates[i]).toBeGreaterThan(dates[i - 1]);
    }
  });
});

describe('kistiRef', () => {
  it('derives the kisti id from the share uid', () => {
    expect(kistiRef('NEO-0012', 2)).toBe('NEO-0012-K2');
    expect(kistiRef('NEO-0001', 4)).toBe('NEO-0001-K4');
  });

  it('rejects invalid installment numbers', () => {
    expect(() => kistiRef('NEO-0012', 0)).toThrow(RangeError);
    expect(() => kistiRef('NEO-0012', 1.5)).toThrow(RangeError);
  });
});

describe('certRef', () => {
  it('derives the certificate number from the share uid', () => {
    expect(certRef('NEO-0012')).toBe('NEO-0012-CERT');
  });
});
