"use server";

import { revalidatePath } from "next/cache";

import { confirmMyInvestment } from "@/lib/scoped-db";

/**
 * Server action: confirms a PENDING investment owned by the current
 * stakeholder. Triggered by the "Yes, my investment details are correct —
 * confirm" button on each pending card.
 *
 * SECURITY: we deliberately do NOT trust the caller to pick which
 * investment gets confirmed. The hidden `investmentId` is forwarded as-is
 * to `confirmMyInvestment(inv.id)`, which AND's `id` with the session's
 * `stakeholderId` inside scoped-db. A tampered id pointing at someone
 * else's record is rejected at the data layer — we never widen the
 * surface here.
 *
 * On success the dashboard path is revalidated so the card re-renders as
 * Confirmed without a manual refresh.
 */
export async function confirmInvestmentAction(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("investmentId") ?? "").trim();
  if (!id) return;

  // Let ownership-violation / DB failures bubble up — scoped-db has
  // already enforced the security predicate, and the surface here is
  // intentionally one-button.
  await confirmMyInvestment(id);

  revalidatePath("/dashboard");
}
