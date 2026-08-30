// Server-only demo-login configuration. No client importers — the action layer
// is the only thing that reads credentials, so they never reach the browser.

import { isDemoData } from '@/data/demo/store';

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

// The demo tour is hard-off unless explicitly opted in via env: either the
// in-memory demo dataset (DEMO_DATA=true, e.g. via scripts/demo.mjs) or
// seeded Supabase demo accounts (DEMO_LOGIN=true). No NODE_ENV shortcut — a
// plain dev run against real data shows no demo UI. The login page and the
// demo actions share this exact gate so the tiles can never render dead.
export function isDemoLoginEnabled(): boolean {
  return isDemoData() || process.env.DEMO_LOGIN === 'true';
}
