import path from 'node:path';
import { prisma } from '@/lib/db';
import { requireInvestor, requireStaff } from '@/lib/auth';
import { handleRouteError, jsonError } from '@/lib/http';
import { storage } from '@/lib/storage';
import { isDemoData } from '@/data/demo/store';

export const runtime = 'nodejs';

function detectContentType(key: string): string {
  const ext = path.extname(key).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  try {
    const { key: keySegments } = await params;
    if (!keySegments || keySegments.length === 0) {
      return jsonError(400, 'BAD_REQUEST', 'Missing file key');
    }

    const key = keySegments.join('/');

    // Check staff access first
    let isStaffUser = false;
    try {
      const staff = await requireStaff();
      if (staff && staff.isActive) {
        isStaffUser = true;
      }
    } catch {
      isStaffUser = false;
    }

    if (!isStaffUser) {
      // Check if authenticated as investor
      const investor = await requireInvestor().catch(() => null);
      if (!investor) {
        return jsonError(401, 'UNAUTHENTICATED', 'Authentication required');
      }

      if (!isDemoData()) {
        // Authorize: check if key belongs to this investor
        const [matchingRequest, matchingInvestment, matchingInvestor] = await Promise.all([
          prisma.investmentRequest.findFirst({
            where: { slipFileKey: key, investorId: investor.id },
            select: { id: true },
          }),
          prisma.investment.findFirst({
            where: {
              OR: [{ slipFileKey: key }, { depositSlipFileKey: key }],
              investorId: investor.id,
            },
            select: { id: true },
          }),
          prisma.investor.findFirst({
            where: { nationalIdFileKey: key, id: investor.id },
            select: { id: true },
          }),
        ]);

        if (!matchingRequest && !matchingInvestment && !matchingInvestor) {
          return jsonError(403, 'FORBIDDEN', 'Forbidden');
        }
      }
    }

    let body: Buffer;
    try {
      body = await storage.downloadFile(key);
    } catch {
      // Missing object (or unreachable backend) must not leak details or break the page.
      return jsonError(404, 'NOT_FOUND', 'File not found');
    }

    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': detectContentType(key),
        'Content-Length': String(body.length),
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
