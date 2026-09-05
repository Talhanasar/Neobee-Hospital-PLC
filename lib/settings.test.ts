import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@/lib/money';
import { getSetting, getSettings, updateSetting, type Settings } from '@/lib/settings';

type SettingRow = {
  key: string;
  value: bigint;
};

type UpsertCall = {
  where: { key: string };
  create: { key: string; value: bigint; updatedByStaffId: string };
  update: { value: bigint; updatedByStaffId: string };
};

type FakeClient = {
  setting: {
    findMany(): Promise<SettingRow[]>;
    findUnique(args: { where: { key: string } }): Promise<SettingRow | null>;
    upsert(args: UpsertCall): Promise<void>;
  };
  auditLog?: {
    create(args: unknown): Promise<void>;
  };
};

function makeClient(rows: SettingRow[], calls?: UpsertCall[]): FakeClient {
  return {
    setting: {
      async findMany() {
        return rows;
      },
      async findUnique({ where }) {
        return rows.find((row) => row.key === where.key) ?? null;
      },
      async upsert(args: UpsertCall) {
        calls?.push(args);
      },
    },
  };
}

const allRows: SettingRow[] = [
  { key: 'SHARE_PRICE', value: BigInt(1) },
  { key: 'INCENTIVE_PER_SHARE', value: BigInt(2) },
  { key: 'TARGET_AMOUNT', value: BigInt(1800000000) },
  { key: 'TARGET_SHARES', value: BigInt(4) },
  { key: 'FOUNDING_AMOUNT', value: BigInt(5) },
  { key: 'TARGET_ENTREPRENEURS', value: BigInt(6) },
  { key: 'FULL_PAYMENT_DISCOUNT_PER_SHARE', value: BigInt(7) },
  { key: 'FULL_PAYMENT_SHARE_LIMIT', value: BigInt(550) },
  { key: 'INSTALLMENT_SHARE_LIMIT', value: BigInt(200) },
  { key: 'INSTALLMENT_UNIT_AMOUNT', value: BigInt(8) },
  { key: 'INSTALLMENT_COUNT', value: BigInt(9) },
];

describe('settings', () => {
  it('returns all keys when the db has all of them', async () => {
    const settings = await getSettings(makeClient(allRows));
    expect(settings).toEqual({
      SHARE_PRICE: 1,
      INCENTIVE_PER_SHARE: 2,
      TARGET_AMOUNT: 1800000000,
      TARGET_SHARES: 4,
      FOUNDING_AMOUNT: 5,
      TARGET_ENTREPRENEURS: 6,
      FULL_PAYMENT_DISCOUNT_PER_SHARE: 7,
      FULL_PAYMENT_SHARE_LIMIT: 550,
      INSTALLMENT_SHARE_LIMIT: 200,
      INSTALLMENT_UNIT_AMOUNT: 8,
      INSTALLMENT_COUNT: 9,
    } satisfies Settings);
  });

  it('falls back to defaults when the table is empty', async () => {
    await expect(getSettings(makeClient([]))).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('falls back for a single missing key', async () => {
    const settings = await getSettings(makeClient(allRows.filter((row) => row.key !== 'TARGET_AMOUNT')));
    expect(settings.TARGET_AMOUNT).toBe(DEFAULT_SETTINGS.TARGET_AMOUNT);
    expect(settings.SHARE_PRICE).toBe(1);
  });

  it('ignores unknown db keys', async () => {
    const settings = await getSettings(makeClient([...allRows, { key: 'UNKNOWN_KEY', value: BigInt(99) }]));
    expect(Object.keys(settings)).toHaveLength(11);
    expect((settings as Record<string, number>).UNKNOWN_KEY).toBeUndefined();
  });

  it('converts bigint values safely', async () => {
    await expect(getSetting('TARGET_AMOUNT', makeClient([{ key: 'TARGET_AMOUNT', value: BigInt(3000000000) }]))).resolves.toBe(3000000000);
  });

  it('rejects bigint values beyond max safe integer', async () => {
    await expect(getSetting('TARGET_AMOUNT', makeClient([{ key: 'TARGET_AMOUNT', value: BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1) }]))).rejects.toThrow(RangeError);
  });

  it('rejects invalid setting values', async () => {
    const client = makeClient([]);
    await expect(updateSetting('SHARE_PRICE', 0, 'staff-1', client)).resolves.toBeUndefined();
    await expect(updateSetting('SHARE_PRICE', -1, 'staff-1', client)).rejects.toThrow(RangeError);
    await expect(updateSetting('SHARE_PRICE', 1.5, 'staff-1', client)).rejects.toThrow(RangeError);
  });

  it('sends the expected upsert payload and no audit write', async () => {
    const calls: UpsertCall[] = [];
    const client = makeClient([], calls);

    await updateSetting('SHARE_PRICE', 42, 'staff-1', client);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      where: { key: 'SHARE_PRICE' },
      create: { key: 'SHARE_PRICE', value: BigInt(42), updatedByStaffId: 'staff-1' },
      update: { value: BigInt(42), updatedByStaffId: 'staff-1' },
    });
    expect(client.auditLog?.create).toBeUndefined();
  });

  it('uses the default when a key is missing', async () => {
    await expect(getSetting('TARGET_AMOUNT', makeClient([]))).resolves.toBe(DEFAULT_SETTINGS.TARGET_AMOUNT);
  });

  it('uses the supplied transaction client instead of the default', async () => {
    const defaultClient = makeClient([]);
    const defaultFindUnique = vi.spyOn(defaultClient.setting, 'findUnique');
    const txClient = makeClient([{ key: 'TARGET_AMOUNT', value: BigInt(77) }]);
    const findUniqueSpy = vi.spyOn(txClient.setting, 'findUnique');

    await expect(getSetting('TARGET_AMOUNT', txClient)).resolves.toBe(77);

    expect(findUniqueSpy).toHaveBeenCalledTimes(1);
    expect(defaultFindUnique).not.toHaveBeenCalled();
  });

  it('propagates database errors from getSettings', async () => {
    const error = new Error('db down');
    const client: FakeClient = {
      setting: {
        async findMany() {
          throw error;
        },
        async findUnique() {
          return null;
        },
        async upsert() {
          return undefined;
        },
      },
    };

    await expect(getSettings(client)).rejects.toBe(error);
  });
});
