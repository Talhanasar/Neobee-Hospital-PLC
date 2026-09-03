import { prisma } from '@/lib/db';
import { requireInvestor, requireStaff } from '@/lib/auth';
import { handleRouteError, jsonError } from '@/lib/http';
import { generateCertificatePdf } from '@/lib/certificate';
import { demoGetInvestorCertificate, isDemoData } from '@/data/demo/store';
import { getSettings } from '@/lib/settings';
import { deriveCategory } from '@/lib/money';

export const runtime = 'nodejs';

// GET /api/investors/[id]/certificate — PDF download of the investor's cumulative
// certificate, aggregating every fully-paid holding. Only fully-paid holdings
// appear; half-paid kisti plans never do.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    const investor = await requireInvestor().catch(() => null);

    if (investor) {
      if (investor.id !== id) return jsonError(403, 'FORBIDDEN', 'Forbidden');
    } else {
      await requireStaff();
    }

    const settings = await getSettings();

    if (isDemoData()) {
      const demo = demoGetInvestorCertificate(id);
      if (!demo) return jsonError(404, 'NOT_FOUND', 'Certificate not available for this investor');
      const pdf = await generateCertificatePdf({
        ...demo,
        investorName: investor?.name ?? '',
        sharePrice: settings.SHARE_PRICE,
      });
      return new Response(Buffer.from(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="certificate-${demo.holdings[0].uid}.pdf"`,
        },
      });
    }

    const rows = await prisma.investment.findMany({
      where: { investorId: id, fullyPaidAt: { not: null } },
      orderBy: { fullyPaidAt: 'asc' },
      select: {
        uid: true,
        code: true,
        shares: true,
        amount: true,
        fullyPaidAt: true,
        certificate: { select: { issuedAt: true } },
      },
    });
    if (rows.length === 0) return jsonError(404, 'NOT_FOUND', 'Certificate not available for this investor');

    // The where-clause guarantees fullyPaidAt is set on every row.
    const holdings = rows.map((r) => ({
      uid: r.uid,
      shares: r.shares,
      amount: r.amount,
      paidAt: r.fullyPaidAt!,
    }));
    const totalShares = holdings.reduce((s, h) => s + h.shares, 0);
    const totalAmount = holdings.reduce((s, h) => s + h.amount, 0);
    const issuedAt = rows.reduce((min, r) => {
      const d = r.certificate?.issuedAt ?? r.fullyPaidAt!;
      return d < min ? d : min;
    }, rows[0].certificate?.issuedAt ?? rows[0].fullyPaidAt!);

    const pdf = await generateCertificatePdf({
      certRef: `${rows[0].uid}-CERT`,
      code: rows[rows.length - 1].code,
      investorName: investor?.name ?? '',
      category: deriveCategory(totalShares),
      shares: totalShares,
      sharePrice: settings.SHARE_PRICE,
      amount: totalAmount,
      issuedAt,
      holdings,
    });

    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="certificate-${rows[0].uid}.pdf"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
