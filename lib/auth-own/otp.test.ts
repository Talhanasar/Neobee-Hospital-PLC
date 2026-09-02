import { describe, expect, it } from 'vitest';
import { generateOtp, hashOtp, generateSessionToken, hashSessionToken } from './otp';

describe('generateOtp', () => {
  it('produces a 6-digit code', () => {
    const code = generateOtp();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('produces varied codes with the real RNG', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      codes.add(generateOtp());
    }
    expect(codes.size).toBeGreaterThanOrEqual(2);
  });
});

describe('hashOtp', () => {
  it('is deterministic and 64 hex chars', () => {
    expect(hashOtp('123456')).toBe(hashOtp('123456'));
    expect(hashOtp('123456')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOtp('123456')).not.toBe(hashOtp('654321'));
  });
});

describe('generateSessionToken', () => {
  it('is 256-bit base64url (43 chars, url-safe charset)', () => {
    const token = generateSessionToken();
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('produces varied tokens with the real RNG', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      tokens.add(generateSessionToken());
    }
    expect(tokens.size).toBeGreaterThanOrEqual(2);
  });
});

describe('hashSessionToken', () => {
  it('is deterministic sha256 hex', () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(token)).not.toBe(hashSessionToken(generateSessionToken()));
  });
});
