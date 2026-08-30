import { DEFAULT_SETTINGS, type SettingKey } from '@/lib/money';
import { prisma } from '@/lib/db';
import { isDemoData } from '@/data/demo/store';
import { DEMO_SETTINGS } from '@/data/demo/dataset';

type SettingRow = {
  key: string;
  value: bigint;
};

type SettingsClient = {
  setting: {
    findMany(): Promise<SettingRow[]>;
    findUnique(args: { where: { key: string } }): Promise<SettingRow | null>;
    upsert(args: {
      where: { key: string };
      create: { key: string; value: bigint; updatedByStaffId: string };
      update: { value: bigint; updatedByStaffId: string };
    }): Promise<unknown>;
  };
};

const defaultSettingsClient = prisma satisfies SettingsClient;

export type Settings = Record<SettingKey, number>;

function toSafeNumber(value: bigint, key: string): number {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric)) {
    throw new RangeError(`Setting ${key} cannot be represented safely as a number`);
  }
  return numeric;
}

function buildSettings(rows: SettingRow[]): Settings {
  const settings = { ...DEFAULT_SETTINGS } as Settings;
  const keys = new Set<SettingKey>(Object.keys(DEFAULT_SETTINGS) as SettingKey[]);

  for (const row of rows) {
    if (!keys.has(row.key as SettingKey)) {
      // Ignore unknown keys until a schema migration adds them to SettingKey.
      continue;
    }
    settings[row.key as SettingKey] = toSafeNumber(row.value, row.key);
  }

  return settings;
}

export async function getSettings(client: SettingsClient = defaultSettingsClient): Promise<Settings> {
  if (isDemoData()) return { ...DEMO_SETTINGS };
  const rows = await client.setting.findMany();
  return buildSettings(rows);
}

export async function getSetting(key: SettingKey, client: SettingsClient = defaultSettingsClient): Promise<number> {
  const row = await client.setting.findUnique({ where: { key } });
  if (!row) {
    return DEFAULT_SETTINGS[key];
  }
  return toSafeNumber(row.value, key);
}

export async function updateSetting(
  key: SettingKey,
  value: number,
  staffId: string,
  client: SettingsClient = defaultSettingsClient,
): Promise<void> {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError('value must be a positive safe integer');
  }

  // Do not write an audit log here; the caller composes this with writeAuditLog in one transaction.
  await client.setting.upsert({
    where: { key },
    create: { key, value: BigInt(value), updatedByStaffId: staffId },
    update: { value: BigInt(value), updatedByStaffId: staffId },
  });
}

// ponytail: ceiling is one uncached read per request; add caching only if profiling proves it matters.
