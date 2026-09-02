import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, sha256Hex } from './password';

describe('sha256Hex', () => {
  it('deterministic and 64 hex chars', () => {
    expect(sha256Hex('hello')).toBe(sha256Hex('hello'));
    expect(sha256Hex('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    expect(sha256Hex('hello')).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex('hello')).not.toBe(sha256Hex('world'));
  });
});

describe('hashPassword / verifyPassword', () => {
  it('hash -> verify roundtrip succeeds', async () => {
    const stored = await hashPassword('Correct horse battery staple');
    expect(stored).toMatch(/^.+:.+$/);
    expect(await verifyPassword('Correct horse battery staple', stored)).toBe(true);
  });

  it('wrong password fails verification', async () => {
    const stored = await hashPassword('secret');
    expect(await verifyPassword('not-the-password', stored)).toBe(false);
  });

  it('malformed stored string fails without throwing', async () => {
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'no-colon')).toBe(false);
    expect(await verifyPassword('x', 'a:b:c')).toBe(false);
    expect(await verifyPassword('x', ':')).toBe(false);
  });

  it('two hashes of the same password differ (random salt)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same-password', a)).toBe(true);
    expect(await verifyPassword('same-password', b)).toBe(true);
  });

  it('timingSafeEqual path does not throw on length mismatch', async () => {
    const valid = await hashPassword('pw');
    const colon = valid.indexOf(':');
    // valid 16-byte salt, deliberately truncated hash → length mismatch
    const mismatch = valid.slice(0, colon + 1) + 'AAAA';
    expect(await verifyPassword('pw', mismatch)).toBe(false);
    expect(await verifyPassword('pw', valid)).toBe(true);
  });
});
