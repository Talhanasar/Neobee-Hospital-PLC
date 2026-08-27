#!/usr/bin/env node
/**
 * i18n CI Guard
 * Compares messages/en.json and messages/bn.json for identical flattened key sets.
 * ICU plural entries count as their parent key (e.g., "sharesLabel" covers both "one" and "other").
 * Exits 1 on mismatch with details, exits 0 with a one-line success message.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`Failed to load ${path}: ${e.message}`);
    process.exit(1);
  }
}

function flattenKeys(obj, prefix = '', result = new Set()) {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Check if this is an ICU plural object (has 'one' and/or 'other' keys)
      const keys = Object.keys(value);
      const isIcuPlural = keys.length > 0 && keys.every(k => k === 'one' || k === 'other' || k === 'zero' || k === 'two' || k === 'few' || k === 'many');
      if (isIcuPlural) {
        // ICU plural entries count as the parent key only
        result.add(fullKey);
      } else {
        flattenKeys(value, fullKey, result);
      }
    } else {
      result.add(fullKey);
    }
  }
  return result;
}

function main() {
  const enPath = join(ROOT, 'messages', 'en.json');
  const bnPath = join(ROOT, 'messages', 'bn.json');

  const en = loadJson(enPath);
  const bn = loadJson(bnPath);

  const enKeys = flattenKeys(en);
  const bnKeys = flattenKeys(bn);

  const missingInBn = [...enKeys].filter(k => !bnKeys.has(k)).sort();
  const missingInEn = [...bnKeys].filter(k => !enKeys.has(k)).sort();

  let hasMismatch = false;

  if (missingInBn.length > 0) {
    console.error('Keys missing from bn.json:');
    for (const key of missingInBn) {
      console.error(`  - ${key}`);
    }
    hasMismatch = true;
  }

  if (missingInEn.length > 0) {
    console.error('Keys missing from en.json:');
    for (const key of missingInEn) {
      console.error(`  - ${key}`);
    }
    hasMismatch = true;
  }

  if (hasMismatch) {
    console.error(`\nTotal keys: en=${enKeys.size}, bn=${bnKeys.size}`);
    process.exit(1);
  }

  console.log(`i18n OK: ${enKeys.size} keys matched across en.json and bn.json`);
  process.exit(0);
}

main();