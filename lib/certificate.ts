import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { amountInWords, formatBdt, type InvestmentCategory } from '@/lib/money';

export interface CertificateHolding {
  uid: string;
  shares: number;
  amount: number;
  paidAt: Date;
}

export interface CertificateData {
  certRef: string; // `${firstUid}-CERT`
  code: string; // verification code of the most recent fully-paid holding
  investorName: string;
  category: InvestmentCategory;
  shares: number; // total across holdings
  sharePrice: number; // current setting, display only
  amount: number; // total across holdings
  issuedAt: Date; // earliest holding issue/paid date
  holdings: CertificateHolding[]; // sorted oldest first by paidAt
}

function categoryLabel(category: InvestmentCategory): string {
  switch (category) {
    case 'SHAREHOLDER': return 'Shareholder';
    case 'PREMIUM': return 'Premium Shareholder';
    case 'DIRECTOR': return 'Director Shareholder';
    case 'GOLDEN_DIRECTOR': return 'Golden Director Shareholder';
  }
}

export async function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
  const qrPayload = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/verify?code=${encodeURIComponent(data.code)}`;
  const qrBuffer = await QRCode.toBuffer(qrPayload, { type: 'png', margin: 1, scale: 6 });

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: false });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.once('error', reject);
    doc.once('end', () => resolve(Buffer.concat(chunks)));

    // Double gold frame, matching the on-screen certificate.
    doc.rect(30, 30, 535, 771).lineWidth(2).strokeColor('#0B6E99').stroke();
    doc.rect(38, 38, 519, 755).lineWidth(0.75).strokeColor('#0B6E99').stroke();

    const center = (text: string, y: number, opts: { size?: number; bold?: boolean; color?: string } = {}) => {
      doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(opts.size ?? 11)
        .fillColor(opts.color ?? '#000')
        .text(text, 40, y, { width: 515, align: 'center' });
    };

    center('STAKEHOLDER FINANCE PORTAL · CHATTOGRAM', 70, { size: 9, color: '#555' });
    center('NEOBEE HOSPITAL PLC', 92, { size: 20, bold: true });
    center('Certificate of Shareholding', 128, { size: 15, bold: true, color: '#0A4D6B' });

    const body = `This is to certify that ${data.investorName} is registered in the books of Neobee Hospital PLC as a ${categoryLabel(data.category)}, holding a total of ${data.shares} fully paid-up share(s) of Tk ${formatBdt(data.sharePrice)} each, as itemised below.`;
    doc.font('Helvetica').fontSize(11).fillColor('#000').text(body, 90, 190, { width: 415, align: 'center', lineGap: 4 });

    // Holdings table.
    const tableTop = 240;
    const colX = [90, 250, 390, 500];
    const headers = ['UNIQUE ID', 'SHARES', 'AMOUNT', 'PAID ON'];
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#555');
    headers.forEach((h, i) => doc.text(h, colX[i], tableTop, { width: 105 }));
    doc.font('Helvetica').fontSize(10.5).fillColor('#000');
    data.holdings.forEach((h, i) => {
      const y = tableTop + 16 + i * 14;
      doc.text(h.uid, colX[0], y, { width: 105 });
      doc.text(String(h.shares), colX[1], y, { width: 105 });
      doc.text(`Tk ${formatBdt(h.amount)}`, colX[2], y, { width: 105 });
      doc.text(h.paidAt.toISOString().slice(0, 10), colX[3], y, { width: 105 });
    });
    const tableBottom = tableTop + 16 + data.holdings.length * 14 + 6;

    // Totals + paid-up value.
    center(`${amountInWords(data.amount)} taka — total paid-up value`, tableBottom + 12, { size: 10, color: '#555' });
    center(`Tk ${formatBdt(data.amount)}`, tableBottom + 28, { size: 18, bold: true });

    // Details grid.
    const detailY = tableBottom + 52;
    const labels = ['CERTIFICATE NO.', 'DATE OF ISSUE', 'VERIFICATION CODE'];
    const values = [data.certRef, data.issuedAt.toISOString().slice(0, 10), data.code];
    doc.save().moveTo(80, detailY - 6).lineTo(515, detailY - 6).lineWidth(0.75).strokeColor('#0B6E99').stroke().restore();
    labels.forEach((label, i) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#555').text(label, colX[i], detailY, { width: 120 });
      doc.font('Helvetica').fontSize(10.5).fillColor('#000').text(values[i], colX[i], detailY + 14, { width: 120 });
    });

    // QR (left) + Chairman signature (right).
    doc.image(qrBuffer, 95, 480, { width: 96, height: 96 });
    doc.font('Helvetica').fontSize(8.5).fillColor('#555')
      .text(`Verify at the stakeholder portal — code ${data.code}`, 95, 580, { width: 120 });

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text('Jahangir Alam Akash', 290, 545, { width: 120, align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#555').text('Chairman, Neobee Hospital PLC', 290, 560, { width: 120, align: 'center' });
    doc.save().moveTo(290, 540).lineTo(410, 540).lineWidth(0.75).strokeColor('#000').stroke().restore();

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text('Md. Kaisar Chowdhury', 425, 545, { width: 120, align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#555').text('CEO, Neobee Hospital PLC', 425, 560, { width: 120, align: 'center' });
    doc.save().moveTo(425, 540).lineTo(545, 540).lineWidth(0.75).strokeColor('#000').stroke().restore();

    doc.font('Helvetica').fontSize(8.5).fillColor('#777')
      .text(`Issued at: ${data.issuedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`, 40, 755, { width: 515, align: 'right' });

    doc.end();
  });
}
