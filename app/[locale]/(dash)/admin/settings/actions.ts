'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { AuthError, requireStaff } from '@/lib/auth';
import { updateSetting, type Settings } from '@/lib/settings';
import { writeAuditLog, actionVerbs } from '@/lib/audit';
import { ActorType } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { demoUpdateSettings, isDemoData } from '@/data/demo/store';

const SETTING_KEYS = [
  'SHARE_PRICE',
  'INCENTIVE_PER_SHARE',
  'TARGET_AMOUNT',
  'TARGET_SHARES',
  'FOUNDING_AMOUNT',
  'TARGET_ENTREPRENEURS',
] as const;

export type SettingsState = { ok: false; fieldErrors: Record<string, string[]>; formError?: string } | { ok: true };

function flattenFieldErrors(error: z.ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] ? String(issue.path[0]) : 'form';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

// BDT whole taka only: digits with optional thousands separators, never a float.
const bdtInteger = z.preprocess(
  (value) => {
    const raw = String(value ?? '').trim().replace(/,/g, '');
    return /^\d+$/.test(raw) ? Number(raw) : value;
  },
  z
    .number()
    .int('Enter a whole number of taka')
    .min(1, 'Must be greater than zero')
    .max(Number.MAX_SAFE_INTEGER, 'Value is too large'),
);

const settingsSchema = z
  .object({
    SHARE_PRICE: bdtInteger,
    INCENTIVE_PER_SHARE: bdtInteger,
    TARGET_AMOUNT: bdtInteger,
    TARGET_SHARES: bdtInteger,
    FOUNDING_AMOUNT: bdtInteger,
    TARGET_ENTREPRENEURS: bdtInteger,
  })
  .strict() satisfies z.ZodType<Record<(typeof SETTING_KEYS)[number], number>>;

export async function updateSettingsAction(prev: SettingsState, formData: FormData): Promise<SettingsState> {
  let staff;
  try { staff = await requireStaff(); } catch (error) { if (error instanceof AuthError) return { ok: false, fieldErrors: {}, formError: 'Please sign in as staff to continue.' }; throw error; }
  const raw = Object.fromEntries(SETTING_KEYS.map((key) => [key, formData.get(key)]));
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: flattenFieldErrors(parsed.error) };
  const h = await headers();
  const meta = { ipAddress: h.get('x-real-ip')?.trim() ?? null, userAgent: h.get('user-agent') };
  if (isDemoData()) {
    demoUpdateSettings(parsed.data);
    revalidatePath('/admin/settings');
    revalidatePath('/admin');
    revalidatePath('/');
    return { ok: true };
  }
  await prisma.$transaction(async (tx) => {
    for (const key of SETTING_KEYS) {
      await updateSetting(key, parsed.data[key], staff.id, tx);
      await writeAuditLog({ actorType: ActorType.STAFF, actorId: staff.id, action: actionVerbs.settingUpdate, targetType: 'Setting', targetId: key, ipAddress: meta.ipAddress, userAgent: meta.userAgent, metadata: { value: parsed.data[key] } }, tx);
    }
  });
  // Home shows prices; /admin shows target-driven GoalBanner.
  revalidatePath('/admin/settings');
  revalidatePath('/admin');
  revalidatePath('/');
  return { ok: true };
}

export type SettingsFormValues = Pick<Settings, (typeof SETTING_KEYS)[number]>;
