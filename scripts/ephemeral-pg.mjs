#!/usr/bin/env node
/**
 * Ephemeral Postgres cluster manager for integration tests.
 * Subcommands: start | stop
 * Creates a fresh cluster in .ephemeral-pg/ (gitignored), starts on port 54329.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const PG_BIN = 'C:\\Program Files\\PostgreSQL\\18\\bin';
const PORT = 54329;
const DATADIR = join(ROOT, '.ephemeral-pg', 'data');
const STATE_FILE = join(ROOT, '.ephemeral-pg', 'state.json');
const CONNECTION_STRING = `postgresql://postgres@127.0.0.1:${PORT}/postgres`;

function log(...args) {
  console.log('[ephemeral-pg]', ...args);
}

// No shell: spawnSync handles exe paths with spaces correctly on Windows,
// and none of these commands need shell features.
function runSync(cmd, args, options = {}) {
  const fullCmd = `${cmd} ${args.join(' ')}`;
  log(`$ ${fullCmd}`);
  const result = spawnSync(cmd, args, { ...options, shell: false, encoding: 'utf8' });
  if (result.status !== 0) {
    const err = result.stderr?.toString?.() ?? 'unknown error';
    throw new Error(`Command failed (exit ${result.status}): ${fullCmd}\n${err}`);
  }
  return result.stdout?.toString?.() ?? '';
}

async function waitForReady(timeoutMs = 30000) {
  const start = Date.now();
  const { Client } = await import('pg');
  while (Date.now() - start < timeoutMs) {
    const client = new Client({ connectionString: CONNECTION_STRING, connectionTimeoutMillis: 2000 });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      log('Postgres is ready');
      return;
    } catch {
      try { await client.end(); } catch { /* already closed */ }
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error(`Postgres did not become ready within ${timeoutMs}ms`);
}

function writeState(data) {
  mkdirSync(join(ROOT, '.ephemeral-pg'), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
}

function readState() {
  if (!existsSync(STATE_FILE)) return null;
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

async function start() {
  if (existsSync(DATADIR)) {
    log('Data directory already exists, stopping existing cluster first...');
    await stop();
  }

  mkdirSync(DATADIR, { recursive: true });

  log('Initializing database cluster...');
  runSync(`${PG_BIN}\\initdb.exe`, ['-U', 'postgres', '-A', 'trust', '--no-locale', '-E', 'UTF8', '-D', DATADIR]);

  log('Starting Postgres...');
  // On Windows, pg_ctl -o doesn't accept -h; configure listen_addresses in postgresql.conf instead
  const confPath = join(DATADIR, 'postgresql.conf');
  let conf = readFileSync(confPath, 'utf8');
  conf = conf.replace(/^#?listen_addresses\s*=.*/m, "listen_addresses = '127.0.0.1'");
  conf = conf.replace(/^#?port\s*=.*/m, `port = ${PORT}`);
  writeFileSync(confPath, conf);

  // stdio MUST be 'ignore': pg_ctl spawns a detached postgres.exe that inherits its
  // stdio handles, and a piped spawnSync waits for pipe EOF — i.e. until the server
  // exits — which deadlocks the script on Windows. Server output goes to the logfile.
  const startResult = spawnSync(`${PG_BIN}\\pg_ctl.exe`, ['-D', DATADIR, '-l', join(DATADIR, 'postgres.log'), 'start', '-w'], {
    shell: false,
    stdio: 'ignore',
    timeout: 60000,
  });
  if (startResult.status !== 0) {
    const logTail = existsSync(join(DATADIR, 'postgres.log'))
      ? readFileSync(join(DATADIR, 'postgres.log'), 'utf8').split('\n').slice(-8).join('\n')
      : '(no logfile)';
    throw new Error(`pg_ctl start failed (exit ${startResult.status}, error: ${startResult.error ?? 'none'}):\n${logTail}`);
  }

  await waitForReady();

  writeState({ port: PORT, dataDir: DATADIR, connectionString: CONNECTION_STRING, pid: null });
  log(`Cluster started. Ephemeral connection on 127.0.0.1:${PORT} (see ${STATE_FILE})`);
  log(`State written to ${STATE_FILE}`);
}

async function stop() {
  const state = readState();
  if (!state && !existsSync(DATADIR)) {
    log('No cluster to stop');
    return;
  }

  if (existsSync(DATADIR)) {
    log('Stopping Postgres...');
    try {
      runSync(`${PG_BIN}\\pg_ctl.exe`, ['-D', DATADIR, 'stop', '-m', 'fast']);
    } catch (e) {
      log('pg_ctl stop failed (maybe already stopped):', e.message);
    }

    log('Removing data directory...');
    rmSync(DATADIR, { recursive: true, force: true });
  }

  if (existsSync(STATE_FILE)) {
    rmSync(STATE_FILE, { force: true });
  }

  log('Cluster stopped and cleaned up');
}

function printUsage() {
  console.log(`Usage: node scripts/ephemeral-pg.mjs <start|stop>`);
  console.log(`  start  - Initialize and start a fresh Postgres cluster on port ${PORT}`);
  console.log(`  stop   - Stop the cluster and remove the data directory`);
  process.exit(1);
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'start') {
    await start();
  } else if (cmd === 'stop') {
    await stop();
  } else {
    printUsage();
  }
}

main().catch(err => {
  console.error('[ephemeral-pg] Error:', err.message);
  process.exit(1);
});