#!/usr/bin/env node
/**
 * Path-aware migration entry point.
 *
 * Provider resolution:
 * - Explicit: NEOBEE_DB_PROVIDER env var or --provider flag. Accepted values:
 *     supabase — plain `prisma migrate deploy` (all migrations incl. 1_rls),
 *                after a pre-flight check that auth.uid() actually exists.
 *     generic  — mark 1_rls as applied WITHOUT running its SQL, then deploy
 *                the rest; idempotent (skips marking when already recorded).
 * - Inferred (no explicit provider): from the effective URL (DIRECT_URL ||
 *   DATABASE_URL), without ever printing it.
 *     Supabase host        -> supabase mode (plain deploy, with pre-flight)
 *     anything else        -> supabase-with-shim mode: apply
 *                             scripts/supabase-compat.sql, deploy, re-apply
 *                             (post-deploy grants), so 1_rls and RLS work on
 *                             local/Neon Postgres too.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const SHIM_SQL = join(ROOT, 'scripts', 'supabase-compat.sql');

// Plain `node` does not load .env (only the Prisma CLI / Next.js do), and
// Prisma 7 stopped auto-loading it too. Load .env.local BEFORE .env: on this
// Node process.loadEnvFile() never overwrites values already in process.env
// (shell wins over files; first-loaded file wins over later files), so this
// order reproduces the Next.js result where .env.local takes precedence.
// A missing file throws ENOENT and is silently fine (CI passes URLs via shell).
for (const envFile of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(join(ROOT, envFile));
    console.log(`loaded ${envFile}`);
  } catch {
    // not present
  }
}

function printAcceptedValues() {
  console.error(`
Accepted values for NEOBEE_DB_PROVIDER / --provider:
  supabase  — Database is Supabase-hosted; auth.uid() exists and the 1_rls
              migration applies (RLS active as defense-in-depth).
  generic   — Skip 1_rls deliberately; the API layer becomes the ONLY
              access-control enforcement.

Anything else (including supabase-with-shim) is not accepted explicitly:
without an explicit value the runner infers the mode from the host in the
connection URL.
`);
}

function validateProvider(value) {
  if (value !== 'supabase' && value !== 'generic') {
    console.error(`ERROR: Unrecognised NEOBEE_DB_PROVIDER value: "${value}"\n`);
    printAcceptedValues();
    process.exitCode = 1;
    return false;
  }
  return true;
}

function runPrismaCommand(args, env) {
  const result = spawnSync('pnpm', ['exec', 'prisma', ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    shell: true,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  return result;
}

// Host-based inference using the URL class. Never logs the URL itself.
// Supabase-hosted databases always live on *.supabase.co / *.supabase.com;
// a "supabase" substring elsewhere in the hostname is NOT Supabase hosting.
function looksLikeSupabase(connectionString) {
  try {
    const { hostname } = new URL(connectionString);
    return (
      hostname === 'supabase.co' ||
      hostname === 'supabase.com' ||
      hostname.endsWith('.supabase.co') ||
      hostname.endsWith('.supabase.com')
    );
  } catch {
    return false;
  }
}

// Idempotency pre-check: is 1_rls already recorded as finished? Queries the
// database directly instead of parsing Prisma error text. A fresh DB has no
// _prisma_migrations table yet (SQLSTATE 42P01) — treated as not recorded.
async function isOneRlsRecorded(connectionString) {
  const { Client } = await import('pg');
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const res = await client.query(
      `SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '1_rls' AND finished_at IS NOT NULL LIMIT 1`
    );
    return res.rowCount > 0;
  } catch (err) {
    if (err && err.code === '42P01') return false; // undefined_table: fresh DB
    throw err;
  } finally {
    try { await client.end(); } catch { /* already closed */ }
  }
}

// Pre-flight for supabase mode: does auth.uid() exist? Same pg client pattern
// as the idempotency check above.
async function authUidExists(connectionString) {
  const { Client } = await import('pg');
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const res = await client.query(
      `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'auth' AND p.proname = 'uid' LIMIT 1`
    );
    return res.rowCount > 0;
  } finally {
    try { await client.end(); } catch { /* already closed */ }
  }
}

function psqlAvailable() {
  return spawnSync('psql', ['--version'], { shell: true, encoding: 'utf8' }).status === 0;
}

// psql environment built from the URL so the connection string never appears
// in argv (visible in process listings) and PGPASSWORD is not forced empty.
// Values are never logged.
function psqlEnvFromUrl(connectionString) {
  const url = new URL(connectionString);
  const env = { ...process.env };
  env.PGHOST = url.hostname;
  env.PGPORT = url.port || '5432';
  env.PGUSER = decodeURIComponent(url.username) || 'postgres';
  env.PGDATABASE = decodeURIComponent(url.pathname.replace(/^\//, '')) || 'postgres';
  if (url.password) env.PGPASSWORD = decodeURIComponent(url.password); // only if the URL carries one
  const sslmode = url.searchParams.get('sslmode');
  if (sslmode) env.PGSSLMODE = sslmode;
  return env;
}

// Apply scripts/supabase-compat.sql via psql. Returns true on success; on
// failure prints a clear message naming the requirement and sets exit code 1.
function applyShim(connectionString) {
  if (!psqlAvailable()) {
    console.error(`
ERROR: psql was not found on PATH.

The auto-shim mode needs psql (PostgreSQL client tools) to apply
scripts/supabase-compat.sql. Install the PostgreSQL client tools, make sure
psql is on PATH, and re-run. Alternatively set NEOBEE_DB_PROVIDER=generic to
skip 1_rls (runs WITHOUT RLS).
`);
    process.exitCode = 1;
    return false;
  }
  // Command-logging line: shows the exact argv — no connection string in it.
  console.log(`$ psql -f scripts/supabase-compat.sql  (connection passed via PG* env vars, never argv)`);
  const result = spawnSync('psql', ['-f', SHIM_SQL], {
    cwd: ROOT,
    shell: true,
    encoding: 'utf8',
    stdio: 'inherit',
    env: psqlEnvFromUrl(connectionString),
  });
  if (result.status !== 0) {
    console.error(
      `\nERROR: applying scripts/supabase-compat.sql failed (exit ${result.status}).\npsql is available but the shim did not apply cleanly — see the psql output above and fix before re-running.`
    );
    process.exitCode = 1;
    return false;
  }
  return true;
}

async function main() {
  // Parse CLI --provider flag (overrides the env var)
  let explicitProvider = process.env.NEOBEE_DB_PROVIDER;
  let providerSource = explicitProvider ? 'env' : null;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--provider=')) {
      explicitProvider = arg.split('=')[1];
      providerSource = 'flag';
    }
  }

  const effectiveUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (explicitProvider && !validateProvider(explicitProvider)) {
    return;
  }

  // ---- Explicit generic: skip 1_rls (unchanged flow + explicit note) ----
  if (explicitProvider === 'generic') {
    console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║ WARNING: RLS is NOT active on this database                                    ║
║                                                                                 ║
║ The 1_rls migration (Supabase RLS policies) will be MARKED AS APPLIED          ║
║ but its SQL will NOT be executed, because auth.uid() does not exist on         ║
║ generic Postgres (Neon/local).                                                  ║
║                                                                                 ║
║ The API layer is the ONLY enforcement of access control.                       ║
║ This is a REDUCTION from the designed defense-in-depth posture.                ║
║                                                                                 ║
║ NEOBEE_DB_PROVIDER was set explicitly (${providerSource === 'flag' ? '--provider flag' : 'env var'}); host-based inference      ║
║ was skipped. Unset it to let the runner auto-apply the compat shim instead.    ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

    if (!effectiveUrl) {
      console.error('ERROR: DATABASE_URL must be set so the runner can check the migration state.');
      process.exitCode = 1;
      return;
    }

    let alreadyRecorded = false;
    try {
      alreadyRecorded = await isOneRlsRecorded(effectiveUrl);
    } catch (err) {
      console.error(`ERROR: could not check migration state in the database: ${err.message}`);
      process.exitCode = 1;
      return;
    }

    if (alreadyRecorded) {
      console.log('1_rls is already marked applied; its SQL was never executed on this database.');
    } else {
      console.log('Marking 1_rls as applied (without executing)...');
      const resolveResult = runPrismaCommand(['migrate', 'resolve', '--applied', '1_rls'], {});
      if (resolveResult.status !== 0) {
        console.error('Failed to mark 1_rls as applied');
        process.exitCode = resolveResult.status ?? 1;
        return;
      }
    }

    console.log('Deploying remaining migrations...');
    const deployResult = runPrismaCommand(['migrate', 'deploy'], {});
    process.exitCode = deployResult.status ?? 0;
    return;
  }

  // ---- Explicit or inferred supabase: plain deploy behind an auth.uid() pre-flight ----
  if (explicitProvider === 'supabase' || looksLikeSupabase(effectiveUrl ?? '')) {
    if (!explicitProvider) {
      console.log('NEOBEE_DB_PROVIDER not set; host looks like Supabase — plain deploy (1_rls applies, RLS active).');
    } else {
      console.log('RLS path A active — 1_rls will apply; auth.uid() expected to exist.');
    }

    if (!effectiveUrl) {
      console.error('ERROR: DATABASE_URL must be set so the runner can verify auth.uid() before deploying.');
      process.exitCode = 1;
      return;
    }

    let uidExists = false;
    try {
      uidExists = await authUidExists(effectiveUrl);
    } catch (err) {
      console.error(`ERROR: could not connect to the database to verify auth.uid(): ${err.message}`);
      process.exitCode = 1;
      return;
    }
    if (!uidExists) {
      console.error(`
ERROR: provider is supabase but auth.uid() is missing — this does not look like
a Supabase-hosted Postgres. If the database is Neon/local, either unset
NEOBEE_DB_PROVIDER to auto-apply the compat shim, or use generic to skip RLS.
`);
      process.exitCode = 1;
      return;
    }

    const result = runPrismaCommand(['migrate', 'deploy'], {});
    process.exitCode = result.status ?? 0;
    return;
  }

  // ---- Inferred supabase-with-shim (no explicit provider, non-Supabase host) ----
  if (!effectiveUrl) {
    // Nothing to infer from; run plain deploy and let Prisma report the
    // missing URL itself.
    const result = runPrismaCommand(['migrate', 'deploy'], {});
    process.exitCode = result.status ?? 0;
    return;
  }

  console.log(`
NEOBEE_DB_PROVIDER not set and host is not Supabase -> applying
scripts/supabase-compat.sql (creates auth.uid() and the Supabase roles) so
1_rls can apply and RLS stays active. To run WITHOUT RLS instead, set
NEOBEE_DB_PROVIDER=generic.
`);

  // Phase 1: shim BEFORE deploy (auth.uid(), roles, schema usage).
  if (!applyShim(effectiveUrl)) return;

  console.log('Deploying migrations...');
  const deployResult = runPrismaCommand(['migrate', 'deploy'], {});
  if ((deployResult.status ?? 0) !== 0) {
    process.exitCode = deployResult.status ?? 1;
    return;
  }

  // Phase 2: shim AFTER deploy (idempotent; refreshes grants on newly created tables).
  console.log('Re-applying compat shim post-deploy (refresh grants on new tables)...');
  applyShim(effectiveUrl);
}

main();
