import "server-only";

import { InvestmentStatus } from "@prisma/client";
import type { Investment } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentStakeholder } from "@/lib/auth";

/**
 * =====================================================================
 *  DB-LAYER SCOPING GUARD for stakeholder data access.
 * =====================================================================
 *
 *  THIS IS THE ENFORCED SECURITY BOUNDARY FOR STAKEHOLDERS.
 *
 *  The app does not yet have Postgres Row-Level Security (RLS). Until RLS
 *  ships, the Prisma layer is the ONLY thing standing between a stakeholder
 *  and another stakeholder's records. Every read and write on a
 *  `Stakeholder`-owned row MUST go through one of the functions below.
 *
 *  RULES — enforced by every function in this file:
 *
 *    1. The current stakeholder is resolved server-side from the Supabase
 *       session via `getCurrentStakeholder()`. NEVER accept a
 *       `stakeholderId` from the caller / URL / form body.
 *
 *    2. Every `where` clause that targets `stakeholderId` is hard-coded
 *       to `me.id` (or AND'd with it when also matching on a unique key).
 *       A stakeholder cannot pass `stakeholderId` in or read another's
 *       row, even by guessing a `NEO-####` `uniqueId`.
 *
 *    3. Writes are intentionally narrow. A stakeholder can only flip a
 *       PENDING investment to CONFIRMED (via `confirmMyInvestment`). All
 *       other mutations (correcting names, shares, deposit info, etc.)
 *       MUST go through an admin.
 *
 *  When Postgres RLS is enabled later, mirror these predicates as policies:
 *      USING (stakeholder_id = current_setting('app.stakeholder_id')::text)
 *  so the database is the second line of defence.
 *
 * =====================================================================
 */

/**
 * Returns every non-deleted investment owned by the current stakeholder,
 * newest first.
 *
 *  - Soft-deleted rows (`deletedAt != null`) are filtered out so a
 *    stakeholder never sees admin-deleted records in their dashboard or
 *    list. (Admins use `adminSoftDeleteInvestment` / `adminRestoreInvestment`
 *    in `admin-db.ts` — the restore path is admin-only.)
 *
 * If no stakeholder session is present (no auth, or the auth user isn't
 * linked to any domain row yet), returns `[]` — never throws, because the
 * dashboard / list pages want to render an empty state, not a 500.
 */
export async function getMyInvestments(): Promise<Investment[]> {
  const me = await getCurrentStakeholder();
  if (!me) return [];

  return prisma.investment.findMany({
    where: { stakeholderId: me.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Fetches a single non-deleted investment by its public `uniqueId`
 * (e.g. `NEO-0042`), BUT only when it belongs to the current stakeholder.
 *
 * The `stakeholderId: me.id` AND-clause is the security-critical bit: a
 * stakeholder who guesses or learns another user's `uniqueId` still gets
 * `null` back, because `where` must match BOTH columns. The
 * `deletedAt: null` clause additionally hides admin-soft-deleted rows
 * from the stakeholder-facing surfaces (receipt page, PDF, etc.).
 *
 * Returns `null` for "not yours" / "soft-deleted" / "doesn't exist" —
 * deliberately indistinguishable, so callers can't probe the ID space
 * OR infer whether a row exists but is deleted.
 */
export async function getMyInvestmentByUniqueId(
  uniqueId: string,
): Promise<Investment | null> {
  const me = await getCurrentStakeholder();
  if (!me) return null;

  const normalized = String(uniqueId ?? "").trim();
  if (!normalized) return null;

  try {
    return await prisma.investment.findFirst({
      where: {
        uniqueId: normalized,
        stakeholderId: me.id,
        deletedAt: null,
      },
    });
  } catch (err) {
    console.warn("[scoped-db] getMyInvestmentByUniqueId failed", err);
    return null;
  }
}

/**
 * Confirms a PENDING investment owned by the current stakeholder.
 *
 *  - Refuses anything that isn't owned by `me` (by AND-ing `id` AND
 *    `stakeholderId` in the lookup).
 *  - Only flips PENDING -> CONFIRMED. CONFIRMED records are no-ops
 *    (idempotent — safe to call twice from a flaky network).
 *  - Records an `AuditLog { action: "CONFIRM", actor: "self" }` so the
 *    timeline of self-actions is preserved alongside admin edits.
 *
 *  Throws on ownership violation or DB failure — callers are expected to
 *  surface a friendly error to the UI rather than silently ignore it.
 *
 *  SECURITY: do NOT add parameters that let the caller pick which fields
 *  to mutate. This function's surface is intentionally one-button: "I
 *  confirm MY pending investment".
 */
export async function confirmMyInvestment(
  investmentId: string,
): Promise<Investment> {
  const me = await getCurrentStakeholder();
  if (!me) {
    throw new Error("Not authenticated as a stakeholder.");
  }
  const id = String(investmentId ?? "").trim();
  if (!id) {
    throw new Error("Missing investment id.");
  }

  // 1. Load with the AND-clause. If this misses, the caller is poking at
  //    someone else's record, a non-existent one, OR an admin-soft-deleted
  //    row — either way, reject. The `deletedAt: null` clause prevents a
  //    stakeholder from confirming an investment that an admin has hidden.
  const investment = await prisma.investment.findFirst({
    where: { id, stakeholderId: me.id, deletedAt: null },
  });
  if (!investment) {
    throw new Error("Investment not found.");
  }

  // 2. Idempotent: CONFIRMED -> no-op, return current row.
  if (investment.status === InvestmentStatus.CONFIRMED) {
    return investment;
  }

  // 3. Only PENDING is self-confirmable. Anything else (a future
  //    REJECTED state, for instance) requires an admin.
  if (investment.status !== InvestmentStatus.PENDING) {
    throw new Error(
      `Investment in status ${investment.status} cannot be self-confirmed.`,
    );
  }

  // 4. Atomic update + audit log. If the update succeeds but the audit
  //    log write fails, the whole thing rolls back — we never want a
  //    CONFIRMED row with no audit trail.
  return prisma.$transaction(async (tx) => {
    const updated = await tx.investment.update({
      where: { id: investment.id },
      data: {
        status: InvestmentStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        investmentId: updated.id,
        action: "CONFIRM",
        actor: "self",
        detail: JSON.stringify({
          source: "stakeholder-self-confirm",
          uniqueId: updated.uniqueId,
          previousStatus: InvestmentStatus.PENDING,
          newStatus: InvestmentStatus.CONFIRMED,
        }),
      },
    });
    return updated;
  });
}
