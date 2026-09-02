import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { amountInWords, formatBdt, certRef, type InvestmentCategory } from '@/lib/money';

export interface CertificateData {
  uid: string;
  code: string;
  investorName: string;
  category: InvestmentCategory;
  shares: number;
  sharePrice: number;
  amount: number;
  issuedAt: Date;
}

function categoryLabel(category: InvestmentData['category']): string {
  switch (category) {
    case 'SHAREHOLDER': return 'Shareholder';
    case 'PREMIUM': return 'Premium Shareholder';
    case 'DIRECTOR': return 'Director Shareholder';
    case 'GOLDEN_DIRECTOR': return 'Golden Director Shareholder';
  }
}

type InvestmentData = CertificateData;

export async function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
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

    const body = `This is to certify that ${data.investorName} is registered in the books of Neobee Hospital PLC as a ${categoryLabel(data.category)}, holding ${data.shares} share(s) of Tk ${formatBdt(data.sharePrice)} each, fully paid-up, vide Unique ID ${data.uid}.`;
    doc.font('Helvetica').fontSize(11).fillColor('#000').text(body, 90, 190, { width: 415, align: 'center', lineGap: 4 });

    center(`${amountInWords(data.amount)} taka — total paid-up value`, 290, { size: 10, color: '#555' });
    center(`Tk ${formatBdt(data.amount)}`, 312, { size: 18, bold: true });

    // Details grid.
    const colX = [95, 265, 435];
    const labels = ['CERTIFICATE NO.', 'DATE OF ISSUE', 'VERIFICATION CODE'];
    const values = [certRef(data.uid), data.issuedAt.toISOString().slice(0, 10), data.code];
    doc.save().moveTo(80, 360).lineTo(515, 360).lineWidth(0.75).strokeColor('#0B6E99').stroke().restore();
    labels.forEach((label, i) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#555').text(label, colX[i], 375, { width: 120 });
      doc.font('Helvetica').fontSize(10.5).fillColor('#000').text(values[i], colX[i], 388, { width: 120 });
    });

    // QR (left) + Chairman signature (right).
    doc.image(qrBuffer, 95, 480, { width: 96, height: 96 });
    doc.font('Helvetica').fontSize(8.5).fillColor('#555')
      .text(`Verify at the stakeholder portal — code ${data.code}`, 95, 580, { width: 120 });

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text('Jahangir Alam Akash', 370, 545, { width: 150, align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#555').text('Chairman, Neobee Hospital PLC', 370, 560, { width: 150, align: 'center' });
    doc.save().moveTo(370, 540).lineTo(500, 540).lineWidth(0.75).strokeColor('#000').stroke().restore();

    doc.font('Helvetica').fontSize(8.5).fillColor('#777')
      .text(`Issued at: ${data.issuedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`, 40, 755, { width: 515, align: 'right' });

    doc.end();
  });
}
