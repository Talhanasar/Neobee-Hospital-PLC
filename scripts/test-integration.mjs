#!/usr/bin/env node
/**
 * Integration test orchestrator.
 * 1. Starts ephemeral Postgres cluster
 * 2. Applies supabase-compat.sql shim
 * 3. Runs prisma migrate deploy
 * 4. Runs vitest with integration config
 * 5. ALWAYS tears down (even on failure)
 * 6. Propagates vitest exit code
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const EPHEMERAL_PG = join(ROOT, 'scripts', 'ephemeral-pg.mjs');
const SHIM_SQL = join(ROOT, 'scripts', 'supabase-compat.sql');
const VITEST_INTEGRATION_CONFIG = join(ROOT, 'vitest.config.integration.mts');

function log(...args) {
  console.log('[test-integration]', ...args);
}

function run(cmd, args, options = {}) {
  const fullCmd = `${cmd} ${args.join(' ')}`;
  log(`$ ${fullCmd}`);
  const result = spawnSync(cmd, args, {
    timeout: 120000,
    ...options,
    shell: true,
    encoding: 'utf8',
    stdio: 'inherit',
    cwd: ROOT,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed (exit ${result.status}${result.error ? `, ${result.error}` : ''}): ${fullCmd}`);
  }
  return result;
}

async function main() {
  let pgStarted = false;
  let exitCode = 0;

  try {
    // 1. Start ephemeral Postgres
    log('Starting ephemeral Postgres...');
    run('node', [EPHEMERAL_PG, 'start']);
    pgStarted = true;

    // Read connection string from state file
    const state = JSON.parse(readFileSync(join(ROOT, '.ephemeral-pg', 'state.json'), 'utf8'));
    const connectionString = state.connectionString;
    log(`Using ephemeral connection on ${new URL(connectionString).host}`);

    // 2. Apply supabase-compat.sql shim BEFORE migrate deploy
    log('Applying Supabase compatibility shim...');
    run('psql', [connectionString, '-f', SHIM_SQL], { env: { ...process.env, PGPASSWORD: '' } });

    // 3. Run prisma migrate deploy
    // The compat shim (applied in step 2) synthesizes auth.uid() and the Supabase roles,
    // so this legitimately runs 1_rls even though the ephemeral DB is vanilla Postgres.
    // This is how the RLS tests prove cross-tenant denial.
    log('Running prisma migrate deploy...');
    run('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: connectionString, DIRECT_URL: connectionString },
    });

    // 3b. Re-apply the shim post-deploy so the GRANT ... ON ALL TABLES statements
    // hit the tables the migrations just created (idempotent).
    log('Re-applying Supabase compatibility shim (post-deploy grants)...');
    run('psql', [connectionString, '-f', SHIM_SQL], { env: { ...process.env, PGPASSWORD: '' } });

    // 4. Run vitest with integration config
    log('Running integration tests...');
    const vitestResult = run('pnpm', ['exec', 'vitest', 'run', '--config', VITEST_INTEGRATION_CONFIG], {
      env: { ...process.env, DATABASE_URL: connectionString, DIRECT_URL: connectionString },
      timeout: 300000,
    });
    exitCode = vitestResult.status ?? 0;
  } catch (err) {
    log('Error:', err.message);
    exitCode = err instanceof Error && 'status' in err ? err.status : 1;
  } finally {
    // 5. ALWAYS teardown
    if (pgStarted) {
      log('Tearing down ephemeral Postgres...');
      try {
        run('node', [EPHEMERAL_PG, 'stop']);
      } catch (e) {
        log('Teardown warning:', e.message);
      }
    }
  }

  process.exit(exitCode);
}

main().catch(err => {
  console.error('[test-integration] Fatal:', err.message);
  process.exit(1);
});