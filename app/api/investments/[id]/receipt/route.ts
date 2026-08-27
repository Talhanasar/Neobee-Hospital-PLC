import { prisma } from '@/lib/db';
import { requireInvestor, requireStaff } from '@/lib/auth';
import { handleRouteError, jsonError } from '@/lib/http';
import { generateReceiptPdf } from '@/lib/receipt';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    const investor = await requireInvestor().catch(() => null);
    if (investor) {
      const investment = await prisma.investment.findUnique({ where: { id }, select: { investorId: true } });
      if (investment?.investorId !== investor.id) {
        return jsonError(403, 'FORBIDDEN', 'Forbidden');
      }
    } else {
      await requireStaff();
    }

    const investment = await prisma.investment.findUnique({
      where: { id },
      select: {
        uid: true,
        code: true,
        investor: { select: { name: true, phone: true, nationalIdNumber: true } },
        category: true,
        shares: true,
        sharePrice: true,
        amount: true,
        isEntrepreneur: true,
        incentiveAmount: true,
        depositMethod: true,
        depositRef: true,
        depositDate: true,
        status: true,
      },
    });
    if (!investment) return jsonError(404, 'NOT_FOUND', 'Record not found');

    const pdf = await generateReceiptPdf({
      uid: investment.uid,
      code: investment.code,
      investorName: investment.investor.name,
      investorPhone: investment.investor.phone,
      nationalIdNumber: investment.investor.nationalIdNumber,
      category: investment.category,
      shares: investment.shares,
      sharePrice: investment.sharePrice,
      amount: investment.amount,
      isEntrepreneur: investment.isEntrepreneur,
      incentiveAmount: investment.incentiveAmount,
      depositMethod: investment.depositMethod,
      depositRef: investment.depositRef,
      depositDate: investment.depositDate,
      status: investment.status,
      issuedAt: new Date(),
    });


    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${investment.uid}-receipt.pdf"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
