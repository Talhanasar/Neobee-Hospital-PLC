import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

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
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL'
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

let urlRef = '';
let urlValid = false;
let urlHostPattern = false;

const supabaseUrl = resolvedEnv['NEXT_PUBLIC_SUPABASE_URL'].value;
if (supabaseUrl) {
  try {
    const parsed = new URL(supabaseUrl);
    urlValid = parsed.protocol === 'https:';
    const host = parsed.hostname;
    // pattern <ref>.supabase.co
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/);
    if (match) {
      urlHostPattern = true;
      urlRef = match[1];
    }
    console.log(`SUPABASE_URL valid https: ${urlValid}`);
    console.log(`SUPABASE_URL host pattern <ref>.supabase.co: ${urlHostPattern}`);
    console.log(`SUPABASE_URL ref: ${urlRef || 'none'}`);
  } catch {
    console.log('SUPABASE_URL parse error: invalid URL');
  }
} else {
  console.log('SUPABASE_URL is missing or empty');
}

function classifyKey(keyVal) {
  if (!keyVal) return { classification: 'other/empty', length: 0, refMatch: null };
  const length = keyVal.length;
  let classification = 'other/empty';
  let refMatch = null;

  if (keyVal.startsWith('sbp_')) {
    classification = 'sb_publishable';
  } else if (keyVal.startsWith('sbsecret_') || keyVal.startsWith('sbs_')) {
    classification = 'sb_secret';
  } else if (keyVal.startsWith('ey') && keyVal.split('.').length === 3) {
    classification = 'legacy-jwt';
    try {
      const parts = keyVal.split('.');
      let payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (payloadBase64.length % 4) {
        payloadBase64 += '=';
      }
      const decodedPayload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
      if (decodedPayload && decodedPayload.iss) {
        const iss = decodedPayload.iss;
        const issMatch = iss.match(/:\/\/([a-z0-9-]+)\.supabase\.co/);
        if (issMatch && urlRef) {
          refMatch = (issMatch[1] === urlRef);
        } else if (decodedPayload.ref) {
          refMatch = (decodedPayload.ref === urlRef);
        }
      }
    } catch {
      // decoding failed
    }
  }

  return { classification, length, refMatch };
}

const anonKeyInfo = classifyKey(resolvedEnv['NEXT_PUBLIC_SUPABASE_ANON_KEY'].value);
console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY classification: ${anonKeyInfo.classification}, length: ${anonKeyInfo.length}, ref-match: ${anonKeyInfo.refMatch}`);

const serviceKeyInfo = classifyKey(resolvedEnv['SUPABASE_SERVICE_ROLE_KEY'].value);
console.log(`SUPABASE_SERVICE_ROLE_KEY classification: ${serviceKeyInfo.classification}, length: ${serviceKeyInfo.length}, ref-match: ${serviceKeyInfo.refMatch}`);

const dbUrl = resolvedEnv['DATABASE_URL'].value;
if (dbUrl) {
  const schemeMatch = dbUrl.match(/^([a-zA-Z0-9+-.]+):\/\//);
  console.log(`DATABASE_URL status: present, scheme: ${schemeMatch ? schemeMatch[1] : 'unknown'}`);
} else {
  console.log('DATABASE_URL status: MISSING');
}

// Live probe
async function probe() {
  if (!supabaseUrl || !resolvedEnv['NEXT_PUBLIC_SUPABASE_ANON_KEY'].value) {
    console.log('PROBE_RESULT: skipped (missing url or anon key)');
    return 'skipped';
  }

  return new Promise((resolve) => {
    const targetUrl = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/settings`;
    const options = {
      headers: {
        'apikey': resolvedEnv['NEXT_PUBLIC_SUPABASE_ANON_KEY'].value
      },
      timeout: 10000
    };

    const req = https.get(targetUrl, options, (res) => {
      console.log(`HTTP status code: ${res.statusCode}`);
      if (res.statusCode === 401) {
        console.log('PROBE_RESULT: anon key rejected');
        resolve('anon key rejected (401)');
      } else if (res.statusCode === 200) {
        console.log('PROBE_RESULT: anon key accepted');
        resolve('anon key accepted (200)');
      } else {
        console.log(`PROBE_RESULT: status ${res.statusCode}`);
        resolve(`status ${res.statusCode}`);
      }
      res.resume();
    });

    req.on('error', () => {
      console.log('PROBE_RESULT: network error');
      resolve('network error');
    });

    req.on('timeout', () => {
      req.destroy();
      console.log('PROBE_RESULT: network error');
      resolve('network error');
    });
  });
}

(async () => {
  const probeResult = await probe();
  const summary = `SUMMARY: ${probeResult}; URL ref=${urlRef || 'none'}; key=${anonKeyInfo.classification} ref-mismatch=${anonKeyInfo.refMatch === false}`;
  console.log(summary);
  process.exit(0);
})();
