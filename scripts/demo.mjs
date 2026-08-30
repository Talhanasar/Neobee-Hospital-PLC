#!/usr/bin/env node
/**
 * One-command local demo — presentation mode with ZERO external dependencies.
 *
 *   node scripts/demo.mjs          → dev server on DEMO_DATA=true (static dataset)
 *   node scripts/demo.mjs stop     → no-op (nothing to clean up in data mode)
 *
 * What `start` does:
 *   Boots `next dev` with DEMO_DATA=true. Every read serves the static
 *   dataset from data/demo/dataset.ts (in-memory mutations only), and the
 *   demo login tiles sign in via a local cookie — no Postgres, no Supabase,
 *   no seed, nothing to wipe. Restarting resets the demo story.
 *
 * To show REAL data again, just run `pnpm dev` as usual (DEMO_DATA unset).
 */

import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const DEMO_PORT = process.env.DEMO_PORT ?? '3000';

function log(...args) {
  console.log('[demo]', ...args);
}

/** Load .env values WITHOUT overriding real process env (same precedence as Node --env-file).
    Handles inline `KEY=value # comment` — the comment (and its em-dashes) must never
    leak into values that end up in HTTP headers. */
function loadDotEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return {};
  const values = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.split(/\s#/)[0].trim();
    }
    if (value !== '' && process.env[match[1]] === undefined) values[match[1]] = value;
  }
  return values;
}

const dotEnv = loadDotEnv();
const cmd = process.argv[2];

if (cmd === 'stop') {
  log('Nothing to clean up — data mode keeps no database and no auth users.');
  process.exit(0);
}
if (cmd !== undefined && cmd !== 'start') {
  console.log('Usage: node scripts/demo.mjs [start|stop]');
  process.exit(1);
}

// ── start ─────────────────────────────────────────────────────────
const baseEnv = { ...process.env, ...dotEnv, ...process.env }; // real env wins last
const demoEnv = { ...baseEnv, DEMO_DATA: 'true', NEXT_PUBLIC_DEMO_DATA: 'true' };

try {
  log('');
  log('══════════════════════════════════════════════════════════════');
  log('  DEMO READY — http://localhost:' + DEMO_PORT);
  log('  Login → "Demo investor" (Rahim Uddin) or "Demo admin".');
  log('  Data: static dataset in data/demo/ — no database involved.');
  log('  Press Ctrl+C to stop. Real data: plain `pnpm dev` (DEMO_DATA unset).');
  log('══════════════════════════════════════════════════════════════');
  log('');

  const dev = spawn('npx', ['next', 'dev', '-p', DEMO_PORT], {
    stdio: 'inherit',
    shell: true, // npx on Windows
    env: demoEnv,
    cwd: ROOT,
  });

  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    if (dev.pid) {
      // Kill the whole Windows process tree — npx wraps a child node.
      spawnSync('taskkill', ['/PID', String(dev.pid), '/T', '/F'], { stdio: 'ignore', shell: false });
    }
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  await new Promise((resolve) => dev.on('exit', resolve));
  stop();
} catch (err) {
  console.error('[demo] Error:', err.message);
  process.exit(1);
}
