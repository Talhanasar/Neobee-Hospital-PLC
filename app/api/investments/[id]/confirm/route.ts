import { requireInvestor, assertOwnsInvestment } from '@/lib/auth';
import { handleRouteError } from '@/lib/http';
import { getRequestMetadata } from '@/lib/audit';
import { confirmInvestment } from '@/lib/investments';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const investor = await requireInvestor();
    const { id } = await params;
    await assertOwnsInvestment(investor.id, id);
    const updated = await confirmInvestment(id, investor.id, getRequestMetadata(_request));
    return Response.json({ status: updated.status });
  } catch (error) {
    return handleRouteError(error);
  }
}
