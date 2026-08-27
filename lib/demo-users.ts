// Server-only demo-login configuration. No client importers — the action layer
// is the only thing that reads credentials, so they never reach the browser.

export const DEMO_INVESTOR = {
  // +880179… prefix avoids colliding with base-seed investors (+880170…).
  // Phone stays for the Investor DB row linkage (find-by-phone); auth is email-based
  // because the Supabase project has phone logins disabled (422 "Phone logins are disabled").
  phone: '+8801790000001',
  email: 'demo-investor@neobee.test',
  password: 'demo-investor-2026',
  name: 'Rahim Uddin',
} as const;

export const DEMO_ADMIN = {
  phone: '+8801790000002',
  email: 'demo-admin@neobee.test',
  password: 'demo-admin-2026',
  name: 'Demo Admin',
} as const;

// Demo is for local/presentation use; hard-off in production unless explicitly
// enabled via DEMO_LOGIN=true.
export function isDemoLoginEnabled(): boolean {
  return process.env.DEMO_LOGIN === 'true' || process.env.NODE_ENV === 'development';
}
