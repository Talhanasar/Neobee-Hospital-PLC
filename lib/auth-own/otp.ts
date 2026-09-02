import { randomInt, randomBytes } from 'node:crypto';
import { sha256Hex } from './password';

const OTP_DIGITS = 6;
const SESSION_TOKEN_BYTES = 32; // 256-bit entropy (OWASP minimum 64 bits far exceeded)

// 6-digit code built from crypto-random digits via randomInt (rejection-sampled
// by Node, never modulo-biased).
export function generateOtp(): string {
  let code = '';
  for (let i = 0; i < OTP_DIGITS; i += 1) {
    code += randomInt(10); // 0–9 inclusive; 10 is exclusive
  }
  return code;
}

// sha256 hex of the OTP code — stored instead of the plaintext code.
export function hashOtp(code: string): string {
  return sha256Hex(code);
}

// 256-bit opaque session token, base64url encoded (no padding).
export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

// sha256 hex of the session token — the raw token never lives in the database.
export function hashSessionToken(token: string): string {
  return sha256Hex(token);
}
