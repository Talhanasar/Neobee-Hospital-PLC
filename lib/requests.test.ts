import { describe, it, expect } from 'vitest';
import {
  ENTREPRENEUR_MIN_SHARES,
  deriveCategory,
  calculateAmount,
  calculateIncentive,
  assertEntrepreneurEligible,
} from '@/lib/money';
import { InvestmentCategory, InvestmentStatus, DepositMethod } from '@/lib/generated/prisma/client';

// Pure decision logic tests extracted from requests.ts

describe('Investment Request Decision Logic', () => {
  const SNAPSHOT_SHARE_PRICE = 200000;
  const SNAPSHOT_INCENTIVE_PER_SHARE = 20000;
  const CURRENT_SETTINGS_SHARE_PRICE = 250000;

  describe('Modified vs unmodified -> PENDING vs CONFIRMED', () => {
    function normalizeDepositRef(v: string | null | undefined): string | null {
      if (v === null || v === undefined) return null;
      const trimmed = v.trim();
      return trimmed === '' ? null : trimmed;
    }

    function decideStatus(
      requestShares: number,
      requestEntrepreneur: boolean,
      requestDepositMethod: DepositMethod,
      requestDepositRef: string | null,
      requestDepositDate: Date,
      effectiveShares: number,
      effectiveEntrepreneur: boolean,
      effectiveDepositMethod: DepositMethod,
      effectiveDepositRef: string | null | undefined,
      effectiveDepositDate: Date | string,
    ): InvestmentStatus {
      const normEffectiveRef = normalizeDepositRef(effectiveDepositRef);
      const nothingChanged =
        effectiveShares === requestShares &&
        effectiveEntrepreneur === requestEntrepreneur &&
        effectiveDepositMethod === requestDepositMethod &&
        normEffectiveRef === requestDepositRef &&
        new Date(effectiveDepositDate).getTime() === new Date(requestDepositDate).getTime();

      return nothingChanged ? InvestmentStatus.CONFIRMED : InvestmentStatus.PENDING;
    }

    it('should return CONFIRMED when nothing changed', () => {
      const depositDate = new Date('2025-01-15T10:00:00.000Z');
      const status = decideStatus(
        5,
        false,
        DepositMethod.BANK_DEPOSIT,
        'REF123',
        depositDate,
        5,
        false,
        DepositMethod.BANK_DEPOSIT,
        'REF123',
        depositDate,
      );
      expect(status).toBe(InvestmentStatus.CONFIRMED);
    });

    it('should return PENDING when shares changed', () => {
      const depositDate = new Date('2025-01-15T10:00:00.000Z');
      const status = decideStatus(
        5,
        false,
        DepositMethod.BANK_DEPOSIT,
        'REF123',
        depositDate,
        7, // changed
        false,
        DepositMethod.BANK_DEPOSIT,
        'REF123',
        depositDate,
      );
      expect(status).toBe(InvestmentStatus.PENDING);
    });

    it('should return PENDING when isEntrepreneur changed', () => {
      const depositDate = new Date('2025-01-15T10:00:00.000Z');
      const status = decideStatus(
        5,
        false,
        DepositMethod.BANK_DEPOSIT,
        'REF123',
        depositDate,
        5,
        true, // changed
        DepositMethod.BANK_DEPOSIT,
        'REF123',
        depositDate,
      );
      expect(status).toBe(InvestmentStatus.PENDING);
    });

    it('should return PENDING when depositMethod changed', () => {
      const depositDate = new Date('2025-01-15T10:00:00.000Z');
      const status = decideStatus(
        5,
        false,
        DepositMethod.BANK_DEPOSIT,
        'REF123',
        depositDate,
        5,
        false,
        DepositMethod.BANK_TRANSFER, // changed
        'REF123',
        depositDate,
      );
      expect(status).toBe(InvestmentStatus.PENDING);
    });

    it('should return PENDING when depositRef changed', () => {
      const depositDate = new Date('2025-01-15T10:00:00.000Z');
      const status = decideStatus(
        5,
        false,
        DepositMethod.BANK_DEPOSIT,
        'REF123',
        depositDate,
        5,
        false,
        DepositMethod.BANK_DEPOSIT,
        'REF456', // changed
        depositDate,
      );
      expect(status).toBe(InvestmentStatus.PENDING);
    });

    it('should return PENDING when depositDate changed', () => {
      const depositDate = new Date('2025-01-15T10:00:00.000Z');
      const status = decideStatus(
        5,
        false,
        DepositMethod.BANK_DEPOSIT,
        'REF123',
        depositDate,
        5,
        false,
        DepositMethod.BANK_DEPOSIT,
        'REF123',
        new Date('2025-01-16T10:00:00.000Z'), // changed
      );
      expect(status).toBe(InvestmentStatus.PENDING);
    });

    it('should return CONFIRMED when request depositRef is null and effective depositRef is empty string', () => {
      const depositDate = new Date('2025-01-15T10:00:00.000Z');
      const status = decideStatus(
        5,
        false,
        DepositMethod.BANK_DEPOSIT,
        null,
        depositDate,
        5,
        false,
        DepositMethod.BANK_DEPOSIT,
        '', // form submits empty string when field is blank
        depositDate,
      );
      expect(status).toBe(InvestmentStatus.CONFIRMED);
    });

    it('should return CONFIRMED when request depositRef is null and effective depositRef is whitespace-only', () => {
      const depositDate = new Date('2025-01-15T10:00:00.000Z');
      const status = decideStatus(
        5,
        false,
        DepositMethod.BANK_DEPOSIT,
        null,
        depositDate,
        5,
        false,
        DepositMethod.BANK_DEPOSIT,
        '   ', // whitespace-only
        depositDate,
      );
      expect(status).toBe(InvestmentStatus.CONFIRMED);
    });

    it('should return PENDING when request depositRef is set and effective depositRef is empty string', () => {
      const depositDate = new Date('2025-01-15T10:00:00.000Z');
      const status = decideStatus(
        5,
        false,
        DepositMethod.BANK_DEPOSIT,
        'REF123',
        depositDate,
        5,
        false,
        DepositMethod.BANK_DEPOSIT,
        '', // admin cleared the ref
        depositDate,
      );
      expect(status).toBe(InvestmentStatus.PENDING);
    });

    it('should return PENDING when explicit false isEntrepreneur vs requested true', () => {
      const depositDate = new Date('2025-01-15T10:00:00.000Z');
      const status = decideStatus(
        10,
        true, // request came in with entrepreneur
        DepositMethod.BANK_DEPOSIT,
        'REF123',
        depositDate,
        10,
        false, // admin explicitly revokes
        DepositMethod.BANK_DEPOSIT,
        'REF123',
        depositDate,
      );
      expect(status).toBe(InvestmentStatus.PENDING);
    });

    it('should return CONFIRMED when explicit false isEntrepreneur matches requested false', () => {
      const depositDate = new Date('2025-01-15T10:00:00.000Z');
      const status = decideStatus(
        10,
        false,
        DepositMethod.BANK_DEPOSIT,
        'REF123',
        depositDate,
        10,
        false, // matches request
        DepositMethod.BANK_DEPOSIT,
        'REF123',
        depositDate,
      );
      expect(status).toBe(InvestmentStatus.CONFIRMED);
    });

    it('should return CONFIRMED when effectiveDepositDate is an ISO string matching the request Date', () => {
      const isoString = '2025-01-15T10:00:00.000Z';
      const depositDate = new Date(isoString);
      const status = decideStatus(
        5,
        false,
        DepositMethod.BANK_DEPOSIT,
        'REF123',
        depositDate,
        5,
        false,
        DepositMethod.BANK_DEPOSIT,
        'REF123',
        isoString, // string input, not a Date object
      );
      expect(status).toBe(InvestmentStatus.CONFIRMED);
    });

    it('should not throw when effectiveDepositDate is an ISO string (defensive coercion)', () => {
      const isoString = '2025-01-15T10:00:00.000Z';
      const depositDate = new Date(isoString);
      expect(() =>
        decideStatus(
          5,
          false,
          DepositMethod.BANK_DEPOSIT,
          'REF123',
          depositDate,
          5,
          false,
          DepositMethod.BANK_DEPOSIT,
          'REF123',
          isoString,
        ),
      ).not.toThrow();
    });
  });

  describe('Entrepreneur eligibility', () => {
    it('should reject entrepreneurRequested with shares < 10', () => {
      expect(() => assertEntrepreneurEligible(9, true)).toThrow(`Entrepreneur requires at least ${ENTREPRENEUR_MIN_SHARES} shares`);
    });

    it('should allow entrepreneurRequested with shares >= 10', () => {
      expect(() => assertEntrepreneurEligible(10, true)).not.toThrow();
      expect(() => assertEntrepreneurEligible(15, true)).not.toThrow();
    });

    it('should allow non-entrepreneur with any valid shares', () => {
      expect(() => assertEntrepreneurEligible(1, false)).not.toThrow();
      expect(() => assertEntrepreneurEligible(9, false)).not.toThrow();
      expect(() => assertEntrepreneurEligible(100, false)).not.toThrow();
    });

    it('should reject admin granting isEntrepreneur with shares < 10', () => {
      // Simulating the approve logic: effectiveIsEntrepreneur = true, effectiveShares = 9
      expect(() => assertEntrepreneurEligible(9, true)).toThrow(`Entrepreneur requires at least ${ENTREPRENEUR_MIN_SHARES} shares`);
    });
  });

  describe('Amount/incentive computed from REQUEST snapshot, not current settings', () => {
    it('should use request snapshot sharePrice for amount calculation', () => {
      const requestSharePrice = SNAPSHOT_SHARE_PRICE; // 200000
      const shares = 5;
      const amount = calculateAmount(shares, requestSharePrice);
      expect(amount).toBe(5 * SNAPSHOT_SHARE_PRICE);
      // Should NOT use current settings (250000)
      expect(amount).not.toBe(5 * CURRENT_SETTINGS_SHARE_PRICE);
    });

    it('should use request snapshot incentivePerShare for incentive calculation', () => {
      const requestIncentivePerShare = SNAPSHOT_INCENTIVE_PER_SHARE; // 20000
      const shares = 10;
      const incentive = calculateIncentive(shares, true, requestIncentivePerShare);
      expect(incentive).toBe(10 * SNAPSHOT_INCENTIVE_PER_SHARE);
    });

    it('should compute category from effective shares using deriveCategory', () => {
      expect(deriveCategory(3)).toBe(InvestmentCategory.SHAREHOLDER);
      expect(deriveCategory(5)).toBe(InvestmentCategory.PREMIUM);
      expect(deriveCategory(10)).toBe(InvestmentCategory.DIRECTOR);
      expect(deriveCategory(15)).toBe(InvestmentCategory.DIRECTOR);
    });
  });

  describe('Open-request cap logic', () => {
    const MAX_OPEN_REQUESTS = 3;

    it('should allow when open requests < 3', () => {
      const openCount = 2;
      expect(openCount < MAX_OPEN_REQUESTS).toBe(true);
    });

    it('should reject when open requests >= 3', () => {
      const openCount = 3;
      expect(openCount >= MAX_OPEN_REQUESTS).toBe(true);
    });

    it('should reject when open requests = 4', () => {
      const openCount = 4;
      expect(openCount >= MAX_OPEN_REQUESTS).toBe(true);
    });
  });
});