import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { extensionForContentType, resolveSafeStoragePath, getStorageDir, getStorageProvider } from './storage';

describe('extensionForContentType', () => {
  it('maps the slip-allowed types to file extensions', () => {
    expect(extensionForContentType('image/jpeg')).toBe('.jpg');
    expect(extensionForContentType('image/png')).toBe('.png');
    expect(extensionForContentType('image/webp')).toBe('.webp');
    expect(extensionForContentType('application/pdf')).toBe('.pdf');
  });

  it('accepts common aliases and case variants', () => {
    expect(extensionForContentType('image/jpg')).toBe('.jpg');
    expect(extensionForContentType('IMAGE/PNG')).toBe('.png');
  });

  it('covers the other types the file route can serve', () => {
    expect(extensionForContentType('image/gif')).toBe('.gif');
  });

  it('returns empty string for unknown or missing types', () => {
    expect(extensionForContentType('application/octet-stream')).toBe('');
    expect(extensionForContentType('')).toBe('');
  });
});

describe('getStorageProvider', () => {
  const original = process.env.NEOBEE_STORAGE_PROVIDER;

  it('defaults to supabase when unset or unrecognized', () => {
    delete process.env.NEOBEE_STORAGE_PROVIDER;
    expect(getStorageProvider()).toBe('supabase');
    process.env.NEOBEE_STORAGE_PROVIDER = 'nonsense';
    expect(getStorageProvider()).toBe('supabase');
  });

  it('selects local only when explicitly requested', () => {
    process.env.NEOBEE_STORAGE_PROVIDER = 'local';
    expect(getStorageProvider()).toBe('local');
    process.env.NEOBEE_STORAGE_PROVIDER = '  LOCAL ';
    expect(getStorageProvider()).toBe('local');
  });

  it('restores the original environment afterwards', () => {
    if (original === undefined) {
      delete process.env.NEOBEE_STORAGE_PROVIDER;
    } else {
      process.env.NEOBEE_STORAGE_PROVIDER = original;
    }
  });
});

describe('resolveSafeStoragePath', () => {
  it('resolves keys inside the storage directory', () => {
    const resolved = resolveSafeStoragePath('slips/abc.jpg');
    expect(resolved).toContain('storage-uploads');
    expect(resolved.endsWith('slips/abc.jpg') || resolved.endsWith('slips\\abc.jpg')).toBe(true);
  });

  it('sanitizes traversal attempts to stay inside the storage directory', () => {
    // Leading ../ sequences are stripped, so the resolved path can never escape.
    const inside = (resolved: string) => {
      const rel = path.relative(path.resolve(getStorageDir()), resolved);
      return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
    };
    expect(inside(resolveSafeStoragePath('../outside.jpg'))).toBe(true);
    expect(inside(resolveSafeStoragePath('slips/../../outside.jpg'))).toBe(true);
  });

  it('rejects absolute keys that escape the storage directory', () => {
    // Absolute keys resolve outside the base dir on every platform.
    expect(() => resolveSafeStoragePath('/etc/passwd')).toThrow();
  });
});
