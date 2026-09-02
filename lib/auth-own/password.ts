import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';

// OWASP scrypt profile: N=2^17, r=8, p=1, keylen=64.
// Node requires an explicit maxmem >= 128 MiB for these parameters; 512 MB gives headroom.
const SCRYPT_N = 1 << 17; // 2^17 = 131072
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 64;
const SALT_LEN = 16;
const MAXMEM = 512 * 1024 * 1024; // 512 MB

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function scryptOptions() {
  return { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAXMEM };
}

export function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, scryptOptions(), (err, derived) => {
      if (err) {
        return reject(err);
      }
      resolve(`${salt.toString('base64')}:${derived.toString('base64')}`);
    });
  });
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  const sep = stored.indexOf(':');
  if (sep === -1) {
    return Promise.resolve(false);
  }

  const saltB64 = stored.slice(0, sep);
  const hashB64 = stored.slice(sep + 1);

  let salt: Buffer;
  let storedHash: Buffer;
  try {
    salt = Buffer.from(saltB64, 'base64');
    storedHash = Buffer.from(hashB64, 'base64');
  } catch {
    return Promise.resolve(false);
  }

  // Only 16-byte salts are produced by hashPassword; reject anything else so we
  // never hand a bogus salt to scrypt.
  if (salt.length !== SALT_LEN) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    scrypt(password, salt, KEYLEN, scryptOptions(), (err, derived) => {
      if (err) {
        return resolve(false);
      }
      // timingSafeEqual throws on length mismatch; guard so a malformed stored
      // hash degrades to "invalid" rather than throwing.
      if (derived.length !== storedHash.length) {
        return resolve(false);
      }
      try {
        resolve(timingSafeEqual(derived, storedHash));
      } catch {
        resolve(false);
      }
    });
  });
}
