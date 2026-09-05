import path from 'node:path';
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

// Tier visuals, mirrored from components/receipt/Certificate.tsx so the printed
// PDF and the on-screen certificate stay consistent. Money receipts are tier-neutral.
const TIER_STYLES: Record<InvestmentCategory, { frame: string; accent: string; soft: string; double: boolean; seal: string | null }> = {
  SHAREHOLDER: { frame: '#0B6E99', accent: '#0A4D6B', soft: '#EFF6FB', double: false, seal: null },
  PREMIUM: { frame: '#5B6B8C', accent: '#44536E', soft: '#EEF0F6', double: false, seal: null },
  DIRECTOR: { frame: '#C9A227', accent: '#8A6D1C', soft: '#FBF3DC', double: false, seal: 'DIRECTOR' },
  GOLDEN_DIRECTOR: { frame: '#A67C00', accent: '#8A6D1C', soft: '#F8ECC8', double: true, seal: 'GOLDEN DIRECTOR' },
};

// Brand mark shipped in public/; pdfkit reads it straight from disk.
const LOGO_PATH = path.join(process.cwd(), 'public', 'images', 'neobee-logo.jpeg');

export async function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
  const qrPayload = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/verify?code=${encodeURIComponent(data.code)}`;
  const qrBuffer = await QRCode.toBuffer(qrPayload, { type: 'png', margin: 1, scale: 6 });
  const tier = TIER_STYLES[data.category];

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: false });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.once('error', reject);
    doc.once('end', () => resolve(Buffer.concat(chunks)));

    // Frame(s), tinted per tier; golden tiers get a third inset line.
    doc.rect(30, 30, 535, 771).lineWidth(2).strokeColor(tier.frame).stroke();
    doc.rect(38, 38, 519, 755).lineWidth(0.75).strokeColor(tier.frame).stroke();
    if (tier.double) {
      doc.rect(44, 44, 507, 743).lineWidth(1).strokeColor(tier.accent).opacity(0.55).stroke();
      doc.opacity(1);
    }

    const center = (text: string, y: number, opts: { size?: number; bold?: boolean; color?: string; italic?: boolean; charSpace?: number } = {}) => {
      doc.font(opts.italic ? 'Helvetica-Oblique' : opts.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(opts.size ?? 11)
        .fillColor(opts.color ?? '#000')
        .text(text, 40, y, { width: 515, align: 'center', characterSpacing: opts.charSpace ?? 0 });
    };

    // Brand mark + header block (logo occupies the top ~124px).
    doc.image(LOGO_PATH, 257, 46, { width: 80, height: 80 });
    center('STAKEHOLDER FINANCE PORTAL · CHATTOGRAM', 148, { size: 9, color: '#555' });
    center('NEOBEE HOSPITAL PLC', 170, { size: 20, bold: true });
    center('Certificate of Shareholding', 206, { size: 15, bold: true, color: tier.accent });

    // Tier ribbon pill.
    const ribbonLabel = categoryLabel(data.category).toUpperCase();
    doc.font('Helvetica-Bold').fontSize(8.5);
    const ribbonWidth = doc.widthOfString(ribbonLabel) + 30;
    const ribbonX = (595 - ribbonWidth) / 2;
    doc.roundedRect(ribbonX, 232, ribbonWidth, 20, 10).fillAndStroke(tier.soft, tier.frame);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(tier.accent)
      .text((tier.seal ? '★ ' : '') + ribbonLabel, ribbonX, 238, { width: ribbonWidth, align: 'center', characterSpacing: 1.2 });
    doc.fillColor('#000');

    // Tier seal medallion, top-right.
    if (tier.seal) {
      const sealR = tier.double ? 40 : 34;
      doc.circle(502, 96, sealR).lineWidth(1.5).strokeColor(tier.accent).stroke();
      doc.circle(502, 96, sealR - 5).lineWidth(0.75).strokeColor(tier.accent).stroke();
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor(tier.accent)
        .text(tier.seal, 502 - sealR, 92, { width: sealR * 2, align: 'center', characterSpacing: 0.8 });
      doc.fillColor('#000');
    }

    const body = `This is to certify that ${data.investorName} is registered in the books of Neobee Hospital PLC as a ${categoryLabel(data.category)}, holding a total of ${data.shares} fully paid-up share(s) of Tk ${formatBdt(data.sharePrice)} each, as itemised below.`;
    doc.font('Helvetica').fontSize(11).fillColor('#000').text(body, 90, 268, { width: 415, align: 'center', lineGap: 4 });

    // Holdings table.
    const tableTop = 318;
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
    doc.save().moveTo(80, detailY - 6).lineTo(515, detailY - 6).lineWidth(0.75).strokeColor(tier.frame).stroke().restore();
    labels.forEach((label, i) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#555').text(label, colX[i], detailY, { width: 120 });
      doc.font('Helvetica').fontSize(10.5).fillColor('#000').text(values[i], colX[i], detailY + 14, { width: 120 });
    });

    // QR (left) + Chairman & CEO signatures (right).
    doc.image(qrBuffer, 95, 558, { width: 96, height: 96 });
    doc.font('Helvetica').fontSize(8.5).fillColor('#555')
      .text(`Verify at the stakeholder portal — code ${data.code}`, 95, 658, { width: 120 });

    const signBlock = (name: string, title: string, x: number) => {
      // Printed-signature look; swap for scanned signature images when provided.
      doc.font('Helvetica-Oblique').fontSize(14).fillColor('#333').text(name, x, 596, { width: 120, align: 'center' });
      doc.save().moveTo(x, 618).lineTo(x + 120, 618).lineWidth(0.75).strokeColor('#000').stroke().restore();
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(name, x, 623, { width: 120, align: 'center' });
      doc.font('Helvetica').fontSize(9).fillColor('#555').text(title, x, 638, { width: 120, align: 'center' });
    };
    signBlock('Jahangir Alam Akash', 'Chairman, Neobee Hospital PLC', 290);
    signBlock('Md. Kaisar Chowdhury', 'CEO, Neobee Hospital PLC', 425);

    doc.font('Helvetica').fontSize(8.5).fillColor('#777')
      .text(`Issued at: ${data.issuedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`, 40, 755, { width: 515, align: 'right' });

    doc.end();
  });
}
