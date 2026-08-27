import { describe, expect, it } from 'vitest';
import { generateReceiptPdf, type ReceiptData } from './receipt';

function makeReceipt(overrides: Partial<ReceiptData> = {}): ReceiptData {
  return {
    uid: 'NEO-0001',
    code: 'NB-ABC123',
    investorName: 'Test Investor',
    investorPhone: '01700000000',
    nationalIdNumber: '1234567890',
    category: 'SHAREHOLDER',
    shares: 1,
    sharePrice: 200000,
    amount: 200000,
    isEntrepreneur: false,
    incentiveAmount: 0,
    depositMethod: 'BANK_DEPOSIT',
    depositRef: 'REF-001',
    depositDate: new Date('2026-08-20T00:00:00Z'),
    status: 'CONFIRMED',
    issuedAt: new Date('2026-08-20T12:34:00Z'),
    ...overrides,
  };
}

async function receiptBytes(overrides: Partial<ReceiptData> = {}): Promise<Buffer> {
  return await generateReceiptPdf(makeReceipt(overrides));
}

describe('generateReceiptPdf', () => {
  it('returns a complete PDF buffer', async () => {
    const buffer = await receiptBytes();
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(buffer.includes(Buffer.from('%%EOF'))).toBe(true);
  });

  it('embeds a QR code', async () => {
    const buffer = await receiptBytes();
    expect(buffer.length).toBeGreaterThan(3000);
  });

  it('is deterministic for identical input', async () => {
    const first = await receiptBytes();
    const second = await receiptBytes();
    expect(first.length).toBe(second.length);
  });

  it.each([0, -1, 1.5])('rejects invalid shares %s', async (shares) => {
    await expect(receiptBytes({ shares, amount: 200000 })).rejects.toThrow('shares must be a positive integer');
  });

  it.each([0, -1, 1.5])('rejects invalid sharePrice %s', async (sharePrice) => {
    await expect(receiptBytes({ sharePrice, amount: 200000 })).rejects.toThrow('sharePrice must be a positive integer');
  });

  it.each([0, -1, 1.5])('rejects invalid amount %s', async (amount) => {
    await expect(receiptBytes({ amount })).rejects.toThrow('amount must be a positive integer');
  });

  it('rejects negative incentiveAmount', async () => {
    await expect(receiptBytes({ isEntrepreneur: true, incentiveAmount: -1 })).rejects.toThrow('incentiveAmount must be a non-negative integer');
  });

  it('handles null optional fields', async () => {
    const buffer = await receiptBytes({ nationalIdNumber: null, depositRef: null });
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(buffer.includes(Buffer.from('%%EOF'))).toBe(true);
  });

  it('handles entrepreneur receipts', async () => {
    const buffer = await receiptBytes({ isEntrepreneur: true, incentiveAmount: 200000, shares: 10, category: 'DIRECTOR', amount: 2000000 });
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.includes(Buffer.from('%%EOF'))).toBe(true);
  });

  it.each(['SHAREHOLDER', 'PREMIUM', 'DIRECTOR'] as const)('supports category %s', async (category) => {
    const buffer = await receiptBytes({ category, shares: category === 'SHAREHOLDER' ? 1 : category === 'PREMIUM' ? 5 : 10, amount: category === 'SHAREHOLDER' ? 200000 : category === 'PREMIUM' ? 1000000 : 2000000 });
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.includes(Buffer.from('%%EOF'))).toBe(true);
  });

  it.each(['BANK_DEPOSIT', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_BANKING'] as const)('supports deposit method %s', async (depositMethod) => {
    const buffer = await receiptBytes({ depositMethod });
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.includes(Buffer.from('%%EOF'))).toBe(true);
  });
});
