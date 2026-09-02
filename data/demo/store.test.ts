import { describe, expect, it } from 'vitest';
import { demoGetReceiptData } from '@/data/demo/store';

describe('demoGetReceiptData — kisti mode', () => {
  // Sultana's installment investment (demo-inv-9014): kisti 1 PAID (kisti unit
  // = INSTALLMENT_UNIT_AMOUNT = 50,000), kistis 2-4 SCHEDULED. 1 share @ 200,000.
  const INVESTMENT_ID = 'demo-inv-9014';
  const UID = 'NEO-9014';
  const SHARE_PRICE = 200000;
  const SHARES = 1;
  const KISTI_UNIT = 50000;

  it('kisti mode with a PAID installment returns the per-kisti receipt', () => {
    const result = demoGetReceiptData(INVESTMENT_ID, 1);
    expect(result).not.toBeNull();
    expect(result!).toMatchObject({
      installmentNo: 1,
      kistiRef: `${UID}-K1`,
      amount: KISTI_UNIT,
      totalAmount: SHARES * SHARE_PRICE,
      paidToDate: KISTI_UNIT, // only kisti 1 is PAID
    });
  });

  it('kisti mode with an unknown installmentNo returns null', () => {
    expect(demoGetReceiptData(INVESTMENT_ID, 999)).toBeNull();
  });

  it('kisti mode with a non-PAID installment returns null', () => {
    // kisti 2 is SCHEDULED (not PAID) — no receipt row exists for it.
    expect(demoGetReceiptData(INVESTMENT_ID, 2)).toBeNull();
  });

  it('legacy mode (no installmentNo) returns the investment-level shape', () => {
    const result = demoGetReceiptData(INVESTMENT_ID);
    expect(result).not.toBeNull();
    expect(result!).toMatchObject({ uid: UID, code: 'NB-DEMSBK', amount: KISTI_UNIT });

    // A FULL-plan investment in legacy mode carries no kistiRef (type-level absence).
    const full = demoGetReceiptData('demo-inv-9001');
    expect(full).not.toBeNull();
    expect(full!).toMatchObject({ paymentPlan: 'FULL' });
    expect(full!).not.toHaveProperty('kistiRef');
  });
});
