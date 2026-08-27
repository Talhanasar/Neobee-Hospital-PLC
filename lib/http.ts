import { ZodError, z } from 'zod';
import { AuthError } from '@/lib/auth';

export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  return Response.json(
    details === undefined ? { error: { code, message } } : { error: { code, message, details } },
    { status },
  );
}

export function handleRouteError(error: unknown): Response {
  if (error instanceof AuthError) {
    return jsonError(error.status, 'AUTH_ERROR', error.message);
  }
  if (error instanceof ZodError) {
    return jsonError(400, 'VALIDATION_ERROR', 'Invalid request', z.treeifyError(error));
  }
  if (error instanceof RangeError) {
    return jsonError(400, 'RANGE_ERROR', error.message);
  }

  const correlationId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : undefined;
  console.error(correlationId ? { correlationId, error } : error);
  return jsonError(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred', correlationId ? { correlationId } : undefined);
}
