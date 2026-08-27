import { createClient } from '@supabase/supabase-js';

export interface StorageAdapter {
  uploadFile(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  deleteFile(key: string): Promise<void>;
}

const bucket = process.env.SUPABASE_STORAGE_BUCKET;
if (!bucket) {
  throw new Error('Missing required environment variable: SUPABASE_STORAGE_BUCKET');
}
const verifiedBucket: string = bucket;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
  throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL');
}
const verifiedSupabaseUrl: string = supabaseUrl;

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) {
  throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
}
const verifiedServiceRoleKey: string = serviceRoleKey;

// Server-only. Never import this into client code; it holds a service-role client that bypasses RLS.
const supabase = createClient(verifiedSupabaseUrl, verifiedServiceRoleKey);

class SupabaseStorageAdapter implements StorageAdapter {
  async uploadFile(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
    const { error } = await supabase.storage.from(verifiedBucket).upload(key, body, { contentType, upsert: true });
    if (error) {
      throw error;
    }
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const { data, error } = await supabase.storage.from(verifiedBucket).createSignedUrl(key, expiresInSeconds);
    if (error) {
      throw error;
    }
    return data.signedUrl;
  }

  async deleteFile(key: string): Promise<void> {
    const { error } = await supabase.storage.from(verifiedBucket).remove([key]);
    if (error) {
      throw error;
    }
  }
}

export const storage: StorageAdapter = new SupabaseStorageAdapter();

// ponytail: ceiling is one storage implementation; add MinIO only when it actually arrives.
