import { prisma } from '@/lib/db';
import { requireInvestor, requireStaff } from '@/lib/auth';
import { handleRouteError, jsonError } from '@/lib/http';
import { generateCertificatePdf } from '@/lib/certificate';
import { demoAssertOwnsInvestment, demoGetCertificate, isDemoData } from '@/data/demo/store';

export const runtime = 'nodejs';

// GET /api/investments/[id]/certificate — PDF download of the investment's
// certificate. Only fully-paid investments have one; everything else 404s.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    const investor = await requireInvestor().catch(() => null);

    if (investor) {
      if (isDemoData()) {
        if (!demoAssertOwnsInvestment(investor.id, id)) return jsonError(403, 'FORBIDDEN', 'Forbidden');
      } else {
        const investment = await prisma.investment.findUnique({ where: { id }, select: { investorId: true } });
        if (investment?.investorId !== investor.id) {
          return jsonError(403, 'FORBIDDEN', 'Forbidden');
        }
      }
    } else {
      await requireStaff();
    }

    if (isDemoData()) {
      const demo = demoGetCertificate(id);
      if (!demo) return jsonError(404, 'NOT_FOUND', 'Certificate not available for this investment');
      const pdf = await generateCertificatePdf({
        uid: demo.uid,
        code: demo.code,
        investorName: investor?.name ?? '',
        category: demo.category,
        shares: demo.shares,
        sharePrice: demo.sharePrice,
        amount: demo.amount,
        issuedAt: demo.issuedAt,
      });
      return new Response(Buffer.from(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${demo.uid}-certificate.pdf"`,
        },
      });
    }

    const investment = await prisma.investment.findFirst({
      where: { id, fullyPaidAt: { not: null } },
      select: {
        uid: true,
        code: true,
        investor: { select: { name: true } },
        category: true,
        shares: true,
        sharePrice: true,
        amount: true,
        fullyPaidAt: true,
        certificate: { select: { issuedAt: true } },
      },
    });
    if (!investment) return jsonError(404, 'NOT_FOUND', 'Certificate not available for this investment');

    const pdf = await generateCertificatePdf({
      uid: investment.uid,
      code: investment.code,
      investorName: investment.investor.name,
      category: investment.category,
      shares: investment.shares,
      sharePrice: investment.sharePrice,
      amount: investment.amount,
      issuedAt: investment.certificate?.issuedAt ?? investment.fullyPaidAt!,
    });

    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${investment.uid}-certificate.pdf"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
