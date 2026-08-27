import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { amountInWords, formatBdt } from '@/lib/money';

export interface ReceiptData {
  uid: string;
  code: string;
  investorName: string;
  investorPhone: string;
  nationalIdNumber: string | null;
  category: 'SHAREHOLDER' | 'PREMIUM' | 'DIRECTOR';
  shares: number;
  sharePrice: number;
  amount: number;
  isEntrepreneur: boolean;
  incentiveAmount: number;
  depositMethod: 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'CHEQUE' | 'MOBILE_BANKING';
  depositRef: string | null;
  depositDate: Date;
  status: 'PENDING' | 'CONFIRMED';
  issuedAt: Date;
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}

function formatDateISO(date: Date): string {
  // ISO-style dates avoid locale drift on server ICU data.
  return date.toISOString().slice(0, 10);
}

function formatUtcTimestamp(date: Date): string {
  // ISO-style UTC timestamps avoid locale drift on server ICU data.
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function categoryLabel(category: ReceiptData['category']): string {
  switch (category) {
    case 'SHAREHOLDER': return 'Shareholder';
    case 'PREMIUM': return 'Premium Shareholder';
    case 'DIRECTOR': return 'Director Shareholder';
  }
}

function depositMethodLabel(method: ReceiptData['depositMethod']): string {
  switch (method) {
    case 'BANK_DEPOSIT': return 'Bank deposit (NEOBEE account)';
    case 'BANK_TRANSFER': return 'Bank transfer';
    case 'CHEQUE': return 'Cheque';
    case 'MOBILE_BANKING': return 'Mobile banking';
  }
}

function addRow(doc: PDFKit.PDFDocument, label: string, value: string, y: number): number {
  const labelWidth = 140;
  const rowHeight = Math.max(doc.heightOfString(value, { width: 340 }), 16);
  doc.font('Helvetica-Bold').fontSize(10).text(`${label}:`, 40, y, { width: labelWidth, continued: false });
  doc.font('Helvetica').fontSize(10).text(value, 40 + labelWidth, y, { width: 340 });
  return y + rowHeight + 8;
}

export async function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  assertPositiveInteger(data.shares, 'shares');
  assertPositiveInteger(data.sharePrice, 'sharePrice');
  assertPositiveInteger(data.amount, 'amount');
  assertNonNegativeInteger(data.incentiveAmount, 'incentiveAmount');
  if (data.isEntrepreneur && data.shares < 10) {
    throw new Error('isEntrepreneur requires at least 10 shares');
  }

  const qrPayload = `NEOBEE HOSPITAL PLC | VERIFY | CODE:${data.code} | UID:${data.uid} | SHARES:${data.shares} | AMOUNT:${data.amount} BDT`;
  const qrBuffer = await QRCode.toBuffer(qrPayload, { type: 'png', margin: 1, scale: 6 });

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: false });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.once('error', reject);
    doc.once('end', () => resolve(Buffer.concat(chunks)));

    doc.font('Helvetica');
    doc.rect(40, 40, 515, 84).lineWidth(1).stroke();
    doc.font('Helvetica-Bold').fontSize(18).text('NEOBEE HOSPITAL PLC', 50, 52, { width: 320 });
    doc.font('Helvetica-Bold').fontSize(16).text('Money Receipt', 50, 75, { width: 220 });
    doc.font('Helvetica').fontSize(11).text(data.uid, 410, 56, { width: 120, align: 'right' });

    let y = 142;
    y = addRow(doc, 'Shareholder name', data.investorName, y);
    y = addRow(doc, 'Contact', data.investorPhone, y);
    if (data.nationalIdNumber !== null) {
      y = addRow(doc, 'NID/Passport', data.nationalIdNumber, y);
    }
    y = addRow(doc, 'Category', categoryLabel(data.category), y);

    // sharePrice is admin-editable, so a receipt must reflect the registration-time snapshot.
    y = addRow(doc, 'Shares', `${data.shares} shares x ${formatBdt(data.sharePrice)}`, y);

    if (data.isEntrepreneur && data.incentiveAmount > 0) {
      y = addRow(doc, 'Share incentive', formatBdt(data.incentiveAmount), y);
    }
    y = addRow(doc, 'Deposit method', depositMethodLabel(data.depositMethod), y);
    if (data.depositRef !== null) {
      y = addRow(doc, 'Reference', data.depositRef, y);
    }
    y = addRow(doc, 'Deposit date', formatDateISO(data.depositDate), y);
    y = addRow(doc, 'Verification code', data.code, y);
    y = addRow(doc, 'Status', data.status === 'PENDING' ? 'Pending' : 'Confirmed', y);
    y = addRow(doc, 'Amount received', formatBdt(data.amount), y);
    addRow(doc, 'Amount in words', amountInWords(data.amount), y);

    doc.image(qrBuffer, 425, 520, { width: 100, height: 100 });
    doc.font('Helvetica').fontSize(9).text(`Issued at: ${formatUtcTimestamp(data.issuedAt)} UTC`, 40, 760, { width: 515, align: 'right' });

    doc.end();
  });
}
