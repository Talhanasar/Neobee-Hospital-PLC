import { prisma } from '@/lib/db';
import { requireInvestor, requireStaff } from '@/lib/auth';
import { handleRouteError, jsonError } from '@/lib/http';
import { generateReceiptPdf } from '@/lib/receipt';
import { getReceiptData } from '@/lib/queries';
import { demoAssertOwnsInvestment, isDemoData } from '@/data/demo/store';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    const kisti = new URL(request.url).searchParams.get('kisti');
    const installmentNo = kisti != null && kisti !== '' && Number.isInteger(Number(kisti)) ? Number(kisti) : undefined;
    const investor = await requireInvestor().catch(() => null);

    if (isDemoData()) {
      if (investor) {
        if (!demoAssertOwnsInvestment(investor.id, id)) return jsonError(403, 'FORBIDDEN', 'Forbidden');
      } else {
        await requireStaff();
      }
    } else {
      if (investor) {
        const investment = await prisma.investment.findUnique({ where: { id }, select: { investorId: true } });
        if (investment?.investorId !== investor.id) {
          return jsonError(403, 'FORBIDDEN', 'Forbidden');
        }
      } else {
        await requireStaff();
      }
    }

    const data = await getReceiptData(id, { installmentNo });
    if (!data) return jsonError(404, 'NOT_FOUND', 'Record not found');
    const pdf = await generateReceiptPdf({ ...data, issuedAt: new Date() });
    const filename = installmentNo != null ? `${data.uid}-K${installmentNo}-receipt.pdf` : `${data.uid}-receipt.pdf`;
    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
