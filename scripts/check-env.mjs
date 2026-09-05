import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const envFiles = ['.env.production.local', '.env.local', '.env.production', '.env'];

const existingFiles = envFiles.filter(f => fs.existsSync(path.join(rootDir, f)));
console.log(`Existing env files: ${existingFiles.length ? existingFiles.join(', ') : 'none'}`);

const fileValues = {};
const fileSources = {};

for (const filename of envFiles) {
  const filePath = path.join(rootDir, filename);
  if (!fs.existsSync(filePath)) continue;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    for (let line of content.split(/\r?\n/)) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in fileValues)) {
        fileValues[key] = val;
        fileSources[key] = filename;
      }
    }
  } catch {
    // ignore read error
  }
}

const varsToCheck = [
  'DATABASE_URL',
  'NEOBEE_STORAGE_PROVIDER',
  'NEOBEE_STORAGE_DIR',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_STORAGE_BUCKET'
];

const resolvedEnv = {};

for (const v of varsToCheck) {
  if (process.env[v] !== undefined && process.env[v] !== '') {
    resolvedEnv[v] = { value: process.env[v], source: 'process-env' };
  } else if (fileValues[v] !== undefined && fileValues[v] !== '') {
    resolvedEnv[v] = { value: fileValues[v], source: fileSources[v] };
  } else {
    resolvedEnv[v] = { value: '', source: 'MISSING' };
  }
}

console.log('Environment resolution:');
for (const v of varsToCheck) {
  console.log(`- ${v}: ${resolvedEnv[v].source}`);
}

const dbUrl = resolvedEnv['DATABASE_URL'].value;
if (dbUrl) {
  const schemeMatch = dbUrl.match(/^([a-zA-Z0-9+-.]+):\/\//);
  console.log(`DATABASE_URL status: present, scheme: ${schemeMatch ? schemeMatch[1] : 'unknown'}`);
} else {
  console.log('DATABASE_URL status: MISSING');
}

const storageDir = resolvedEnv['NEOBEE_STORAGE_DIR'].value;
if (storageDir) {
  console.log(`NEOBEE_STORAGE_DIR: ${storageDir}`);
} else {
  console.log('NEOBEE_STORAGE_DIR: using default (<repo>/storage-uploads)');
}

const storageProvider = (resolvedEnv['NEOBEE_STORAGE_PROVIDER'].value || 'supabase').toLowerCase();
const providerSuffix = resolvedEnv['NEOBEE_STORAGE_PROVIDER'].source === 'MISSING' ? ' (default)' : '';
if (storageProvider === 'supabase') {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET'];
  const missing = required.filter(v => !resolvedEnv[v].value);
  console.log(`NEOBEE_STORAGE_PROVIDER: supabase${providerSuffix}`);
  if (missing.length) {
    console.log(`WARNING: Supabase storage selected but missing ${missing.join(', ')} — slip uploads will fail until these are set.`);
  } else {
    console.log('Supabase storage variables: all present.');
  }
} else if (storageProvider === 'local') {
  console.log(`NEOBEE_STORAGE_PROVIDER: local${providerSuffix} — files stored on the server disk under NEOBEE_STORAGE_DIR.`);
} else {
  console.log(`WARNING: NEOOBEE_STORAGE_PROVIDER=${storageProvider} is not recognized (use 'supabase' or 'local'); falling back to supabase.`);
}

console.log('SUMMARY: environment check complete.');
process.exit(0);
