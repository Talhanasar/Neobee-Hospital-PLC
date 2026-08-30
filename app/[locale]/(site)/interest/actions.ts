'use server';

import { revalidatePath } from 'next/cache';
import { createLead } from '@/lib/leads';
import { submitLeadSchema } from '@/lib/validation';
import { isDemoData } from '@/data/demo/store';
import { actionVerbs, getRequestMetadataFromHeaders } from '@/lib/audit';
import { countRecentAttempts } from '@/lib/rate-limit';
import { ZodError } from 'zod';

export type SubmitLeadState =
  | { ok: false; fieldErrors: Record<string, string[]>; formError?: 'generic' | 'rateLimited' }
  | { ok: false; duplicate: true; duplicateOf: string }
  | { ok: true; ref: string };

const LEAD_RATE_LIMIT = 5;
const LEAD_RATE_WINDOW_MS = 60 * 60 * 1000;

function flattenFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] ? String(issue.path[0]) : 'form';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export async function submitLeadAction(
  prevState: SubmitLeadState,
  formData: FormData,
): Promise<SubmitLeadState> {
  const raw = {
    name: String(formData.get('name') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim(),
    email: (() => {
      const v = String(formData.get('email') ?? '').trim();
      return v || undefined;
    })(),
    message: (() => {
      const v = String(formData.get('message') ?? '').trim();
      return v || undefined;
    })(),
  };

  const parsed = submitLeadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: flattenFieldErrors(parsed.error) };

  const requestMeta = await getRequestMetadataFromHeaders();

  // Spam ceiling: cap successful lead creations per IP per hour. Demo mode
  // runs without a database, so it is exempt.
  if (!isDemoData()) {
    const recentLeads = await countRecentAttempts({
      action: actionVerbs.leadCreate,
      ipAddress: requestMeta.ipAddress,
      windowMs: LEAD_RATE_WINDOW_MS,
    });
    if (recentLeads >= LEAD_RATE_LIMIT) {
      return { ok: false, fieldErrors: {}, formError: 'rateLimited' };
    }
  }

  try {
    const force = formData.get('force') === '1';
    const result = await createLead(parsed.data, requestMeta, { force });
    if (!result.ok) {
      return { ok: false, duplicate: true, duplicateOf: result.duplicateOf };
    }
    if (isDemoData()) revalidatePath('/admin/leads');
    return { ok: true, ref: result.lead.ref };
  } catch {
    return { ok: false, fieldErrors: {}, formError: 'generic' };
  }
}

