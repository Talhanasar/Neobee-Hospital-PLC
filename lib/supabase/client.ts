import { createBrowserClient } from '@supabase/ssr';

class SupabaseBrowserClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseBrowserClientError';
  }
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new SupabaseBrowserClientError('Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseAnonKey) throw new SupabaseBrowserClientError('Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
