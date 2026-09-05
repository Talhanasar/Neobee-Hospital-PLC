import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface StorageAdapter {
  uploadFile(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void>;
  /**
   * Browser-visible URL for a file. Supabase backend: a short-lived signed URL,
   * minted server-side only after an authorization check (same model as the
   * original implementation). Local backend: the guarded /api/files route.
   */
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  /** Raw bytes, streamed through the authorization-checked /api/files route. */
  downloadFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<void>;
}

// supabase — files live in Supabase Storage (correct while the app deploys to
// Vercel, whose filesystem is ephemeral). local — files live on the server's
// disk (the VPS setup). The VPS flip is: NEOBEE_STORAGE_PROVIDER=local.
export type StorageProvider = 'supabase' | 'local';

export function getStorageProvider(): StorageProvider {
  return process.env.NEOBEE_STORAGE_PROVIDER?.trim().toLowerCase() === 'local'
    ? 'local'
    : 'supabase';
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Server-only. Holds a service-role client that bypasses RLS; never import
// this module into client code. The client is built lazily so that merely
// importing the module never throws — DEMO_DATA mode runs with zero env vars.
class SupabaseStorageAdapter implements StorageAdapter {
  private client: SupabaseClient | null = null;

  private clientOrThrow(): SupabaseClient {
    if (!this.client) {
      this.client = createClient(
        requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
        requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      );
    }
    return this.client;
  }

  async uploadFile(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
    const bucket = requireEnv('SUPABASE_STORAGE_BUCKET');
    const { error } = await this.clientOrThrow().storage
      .from(bucket)
      .upload(key, body, { contentType, upsert: true });
    if (error) throw error;
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const bucket = requireEnv('SUPABASE_STORAGE_BUCKET');
    const { data, error } = await this.clientOrThrow().storage
      .from(bucket)
      .createSignedUrl(key, expiresInSeconds);
    if (error) throw error;
    return data.signedUrl;
  }

  async downloadFile(key: string): Promise<Buffer> {
    const bucket = requireEnv('SUPABASE_STORAGE_BUCKET');
    const { data, error } = await this.clientOrThrow().storage.from(bucket).download(key);
    if (error || !data) throw error ?? new Error(`Object not found: ${key}`);
    return Buffer.from(await data.arrayBuffer());
  }

  async deleteFile(key: string): Promise<void> {
    const bucket = requireEnv('SUPABASE_STORAGE_BUCKET');
    const { error } = await this.clientOrThrow().storage.from(bucket).remove([key]);
    if (error) throw error;
  }
}

class LocalDiskStorageAdapter implements StorageAdapter {
  async uploadFile(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
    void contentType;
    const filePath = resolveSafeStoragePath(key);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, body);
  }

  async getSignedUrl(key: string, _expiresInSeconds: number): Promise<string> {
    void _expiresInSeconds;
    const parts = key.split('/').map((segment) => encodeURIComponent(segment)).join('/');
    return `/api/files/${parts}`;
  }

  async downloadFile(key: string): Promise<Buffer> {
    return fs.promises.readFile(resolveSafeStoragePath(key));
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const filePath = resolveSafeStoragePath(key);
      await fs.promises.unlink(filePath);
    } catch {
      // Missing files are ignored
    }
  }
}

export const storage: StorageAdapter =
  getStorageProvider() === 'local' ? new LocalDiskStorageAdapter() : new SupabaseStorageAdapter();

export function getStorageDir(): string {
  return process.env.NEOBEE_STORAGE_DIR || path.join(process.cwd(), 'storage-uploads');
}

// Keys must carry a real extension: the file route derives its Content-Type
// from the extension, and with `X-Content-Type-Options: nosniff` an
// extensionless key would be served as octet-stream and refused by <img>.
export function extensionForContentType(contentType: string): string {
  switch (contentType.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'application/pdf':
      return '.pdf';
    default:
      return '';
  }
}

export function resolveSafeStoragePath(key: string): string {
  const baseDir = path.resolve(getStorageDir());
  const normalizedKey = path.normalize(key).replace(/^(\.\.[\/\\])+/, '');
  const resolved = path.resolve(baseDir, normalizedKey);
  if (!resolved.startsWith(baseDir)) {
    throw new Error('Invalid storage key: path traversal detected');
  }
  return resolved;
}

// ponytail: two storage backends behind one interface; add MinIO only when the VPS actually arrives.
