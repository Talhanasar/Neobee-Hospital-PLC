import "server-only";

import { Prisma, ShareCategory, InvestmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { genUniqueId, genVerificationCode } from "@/lib/ids";
import {
  amountFor,
  categoryFor,
  incentiveFor,
  type ShareCategory as ShareCategoryType,
} from "@/lib/business";

/**
 * =====================================================================
 *  ADMIN-ONLY DB LAYER.
 * =====================================================================
 *
 *  This module is the data-access surface for admin pages and server
 *  actions. It deliberately lives in its own file (rather than being
 *  appended to `scoped-db.ts`) because:
 *
 *    - `scoped-db.ts` enforces the STAKEHOLDER security boundary — every
 *      query there is AND-claused to the current stakeholder. Admins
 *      legitimately need to read/write across ALL stakeholders, and
 *      folding admin queries into the same module would weaken the
 *      invariant that "anything in scoped-db is safe to call from a
 *      stakeholder context".
 *
 *    - Admin writes carry an `AuditLog { actor: admin.id }` requirement.
 *      Co-locating that audit side-effect with the data operations keeps
 *      the boundary crisp: a writer in this file MUST log, because the
 *      helpers below take `adminId` and write the audit row in the same
 *      Prisma transaction.
 *
 *  RULES — every function in this file:
 *
 *    1. Resolves the acting admin via the `adminId` argument. Callers
 *       must obtain the id from `getCurrentAdmin()` (or `requireAdmin()`)
 *       — never accept an admin id from a form body.
 *
 *    2. Mutations happen inside a `prisma.$transaction` that ALSO writes
 *       an `AuditLog` row with `actor = adminId`. A failed audit rolls
 *       back the whole write.
 *
 *    3. Derived financial fields (category, amount, incentiveAmount) are
 *       recomputed server-side from `shares` + `isFoundingEntrepreneur`.
 *       Client-sent values are NEVER trusted.
 *
 *  When Postgres RLS ships, mirror the admin role as a policy and add an
 *  `app.admin_id` setting for the runtime check.
 * =====================================================================
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single investment row joined with its stakeholder — for the admin list. */
export type AdminInvestmentRow = {
  id: string;
  uniqueId: string;
  verificationCode: string;
  shares: number;
  category: ShareCategory;
  isFoundingEntrepreneur: boolean;
  /** BigInt converted to Number — safe at portal magnitudes (<৳2 crore). */
  amount: number;
  /** BigInt converted to Number — same magnitude argument. */
  incentiveAmount: number;
  depositDate: Date | null;
  depositMethod: string | null;
  paymentReference: string | null;
  notes: string | null;
  status: InvestmentStatus;
  confirmedAt: Date | null;
  createdAt: Date;
  /** Soft-delete timestamp — `null` = active, non-null = soft-deleted. */
  deletedAt: Date | null;
  stakeholder: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    nid: string | null;
    /** Admin verification timestamp — null = not yet verified by an admin. */
    verifiedAt: Date | null;
  };
};

/** Aggregate dashboard stats — pre-formatted for the UI. */
export type AdminStats = {
  totalStakeholders: number;
  totalRaised: number;
  sharesSubscribed: number;
  slotsFilled: number;
  foundingRaised: number;
  pendingCount: number;
  confirmedCount: number;
  pendingSum: number;
  confirmedSum: number;
};

/** Filters accepted by `listInvestments`. */
export type InvestmentFilters = {
  search?: string;
  category?: ShareCategoryType | "ALL";
  status?: "PENDING" | "CONFIRMED" | "ALL";
  /**
   * Which slice of soft-deleted rows to show. Defaults to `"active"`, so
   * existing callers keep behaving as before (deleted rows hidden).
   *   - "active"  → only non-deleted rows (`deletedAt: null`)
   *   - "deleted" → only soft-deleted rows (`deletedAt: { not: null }`)
   *   - "all"     → no deletedAt filter at all
   */
  deleted?: "active" | "deleted" | "all";
};

/** Edit payload accepted by `adminUpdateInvestment`. */
export type AdminInvestmentEdit = {
  shares?: number;
  isFoundingEntrepreneur?: boolean;
  depositDate?: Date | null;
  depositMethod?: string | null;
  paymentReference?: string | null;
  notes?: string | null;
  stakeholder?: {
    name?: string;
    phone?: string | null;
    email?: string | null;
    nid?: string | null;
  };
};

/** Manual add payload for `adminCreateStakeholder`. */
export type AdminCreateStakeholder = {
  name: string;
  email?: string | null;
  phone?: string | null;
  nid?: string | null;
  shares: number;
  isFoundingEntrepreneur: boolean;
  depositDate?: Date | null;
  depositMethod?: string | null;
  paymentReference?: string | null;
  notes?: string | null;
  status?: InvestmentStatus; // default PENDING
};

// ---------------------------------------------------------------------------
// Aggregate stats
// ---------------------------------------------------------------------------

/**
 * Dashboard-wide aggregates. Runs a small set of independent queries and
 * stitches the numbers into a flat object — fast enough at portal scale
 * (thousands of rows) without needing raw SQL rollups.
 *
 * BigInt → Number is safe: the largest possible sum is
 * `TOTAL_SHARES × SHARE_PRICE = 15,000 × ৳2,00,000 = ৳3,00,00,00,000`,
 * which fits comfortably in JS `Number`.
 */
export async function getAdminStats(): Promise<AdminStats> {
  // Every investment-side aggregate below AND-s `deletedAt: null` so the
  // public-facing dashboard numbers NEVER include soft-deleted rows. The
  // stakeholder count is left untouched: a stakeholder still exists as an
  // identity even if every one of their investments has been deleted —
  // they're the row's owner, not the row itself.
  const ACTIVE: Prisma.InvestmentWhereInput = { deletedAt: null };

  const [
    totalStakeholders,
    raisedAgg,
    sharesAgg,
    slotsFilled,
    foundingAgg,
    pendingAgg,
    confirmedAgg,
  ] = await Promise.all([
    prisma.stakeholder.count({ where: { deletedAt: null } }),
    prisma.investment.aggregate({
      where: ACTIVE,
      _sum: { amount: true },
    }),
    prisma.investment.aggregate({
      where: ACTIVE,
      _sum: { shares: true },
    }),
    prisma.investment.count({
      where: { ...ACTIVE, isFoundingEntrepreneur: true },
    }),
    prisma.investment.aggregate({
      where: { ...ACTIVE, isFoundingEntrepreneur: true },
      _sum: { amount: true },
    }),
    prisma.investment.aggregate({
      where: { ...ACTIVE, status: "PENDING" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.investment.aggregate({
      where: { ...ACTIVE, status: "CONFIRMED" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  return {
    totalStakeholders,
    totalRaised: numify(raisedAgg._sum.amount),
    sharesSubscribed: sharesAgg._sum.shares ?? 0,
    slotsFilled,
    foundingRaised: numify(foundingAgg._sum.amount),
    pendingCount: pendingAgg._count._all,
    confirmedCount: confirmedAgg._count._all,
    pendingSum: numify(pendingAgg._sum.amount),
    confirmedSum: numify(confirmedAgg._sum.amount),
  };
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

/**
 * Returns investments joined with their stakeholder, filtered + ordered.
 *
 *  - `search` is matched case-insensitively against stakeholder.name,
 *    investment.uniqueId and investment.verificationCode (OR).
 *  - `category` filters by the ShareCategory enum (ALL = no filter).
 *  - `status` filters by InvestmentStatus (ALL = no filter).
 *
 * BigInt fields are converted to Number before crossing the server/client
 * boundary — see AdminInvestmentRow for the magnitude argument.
 */
export async function listInvestments(
  filters: InvestmentFilters = {},
): Promise<AdminInvestmentRow[]> {
  const { search, category, status } = filters;
  // Default `"active"` keeps existing callers behaving exactly as before
  // (soft-deleted rows hidden). Admins opt in to viewing deleted rows
  // via `filters.deleted = "deleted"` / `"all"`.
  const deleted: "active" | "deleted" | "all" = filters.deleted ?? "active";

  const where: Prisma.InvestmentWhereInput = {};

  if (deleted === "active") {
    where.deletedAt = null;
    // Also hide investments whose parent stakeholder is soft-deleted, so the
    // "active" view never surfaces rows tied to a deleted owner. "deleted" /
    // "all" intentionally keep these visible (admins investigating a
    // soft-deleted stakeholder must still see the investments that belong
    // to it).
    where.stakeholder = { deletedAt: null };
  } else if (deleted === "deleted") {
    where.deletedAt = { not: null };
  }
  // "all" → no deletedAt filter applied.

  if (category && category !== "ALL") {
    where.category = category as ShareCategory;
  }
  if (status && status !== "ALL") {
    where.status = status as InvestmentStatus;
  }
  const q = (search ?? "").trim();
  if (q) {
    where.OR = [
      { stakeholder: { name: { contains: q, mode: "insensitive" } } },
      { uniqueId: { contains: q } },
      { verificationCode: { contains: q } },
    ];
  }

  const rows = await prisma.investment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      stakeholder: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          nid: true,
          verifiedAt: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    uniqueId: row.uniqueId,
    verificationCode: row.verificationCode,
    shares: row.shares,
    category: row.category,
    isFoundingEntrepreneur: row.isFoundingEntrepreneur,
    amount: numify(row.amount),
    incentiveAmount: numify(row.incentiveAmount),
    depositDate: row.depositDate,
    depositMethod: row.depositMethod,
    paymentReference: row.paymentReference,
    notes: row.notes,
    status: row.status,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
    stakeholder: row.stakeholder,
  }));
}

/**
 * Fetch a single investment by its DB id — used by the admin edit page.
 * Always includes the stakeholder so the edit form can show the current
 * name/phone/email/nid.
 */
export async function getInvestmentById(
  investmentId: string,
): Promise<(AdminInvestmentRow & { notes: string | null }) | null> {
  const id = String(investmentId ?? "").trim();
  if (!id) return null;

  const row = await prisma.investment.findUnique({
    where: { id },
    include: {
      stakeholder: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          nid: true,
          verifiedAt: true,
        },
      },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    uniqueId: row.uniqueId,
    verificationCode: row.verificationCode,
    shares: row.shares,
    category: row.category,
    isFoundingEntrepreneur: row.isFoundingEntrepreneur,
    amount: numify(row.amount),
    incentiveAmount: numify(row.incentiveAmount),
    depositDate: row.depositDate,
    depositMethod: row.depositMethod,
    paymentReference: row.paymentReference,
    notes: row.notes,
    status: row.status,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
    stakeholder: row.stakeholder,
  };
}

// ---------------------------------------------------------------------------
// Confirm (admin override)
// ---------------------------------------------------------------------------

/**
 * Admin-confirm a PENDING investment. Idempotent — re-confirming a
 * CONFIRMED row is a no-op (the AuditLog won't double-write).
 *
 *  - Refuses REJECTED / future statuses.
 *  - Writes `AuditLog { action: "CONFIRM", actor: adminId }` in the same
 *    transaction as the status flip.
 *
 * `adminId` MUST come from `getCurrentAdmin()` — never from a form field.
 */
export async function adminConfirmInvestment(
  investmentId: string,
  adminId: string,
): Promise<void> {
  const id = String(investmentId ?? "").trim();
  const actor = String(adminId ?? "").trim();
  if (!id) throw new Error("Missing investment id.");
  if (!actor) throw new Error("Missing acting admin id.");

  const existing = await prisma.investment.findUnique({ where: { id } });
  if (!existing) throw new Error("Investment not found.");

  // Idempotent: already CONFIRMED → don't write a second audit row.
  if (existing.status === InvestmentStatus.CONFIRMED) return;

  if (existing.status !== InvestmentStatus.PENDING) {
    throw new Error(
      `Investment in status ${existing.status} cannot be admin-confirmed.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.investment.update({
      where: { id: existing.id },
      data: {
        status: InvestmentStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        investmentId: updated.id,
        action: "CONFIRM",
        actor,
        detail: JSON.stringify({
          source: "admin-override",
          uniqueId: updated.uniqueId,
          previousStatus: InvestmentStatus.PENDING,
          newStatus: InvestmentStatus.CONFIRMED,
        }),
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Stakeholder verification
// ---------------------------------------------------------------------------

/**
 * Set (or clear) the stakeholder verification flag on an investment's owner.
 * Updates `Stakeholder.verifiedAt` and writes an `AuditLog` row in the same
 * transaction so the verification state change is fully traceable.
 *
 *  - `verified = true`  → sets `verifiedAt = new Date()`.
 *  - `verified = false` → sets `verifiedAt = null`.
 *  - NOT idempotent on the flag state — every call writes a fresh audit
 *    row (`VERIFY_STAKEHOLDER` / `UNVERIFY_STAKEHOLDER`). Re-clicking the
 *    same toggle intentionally produces a new audit entry.
 *
 * `adminId` MUST come from `getCurrentAdmin()` — never from a form field.
 */
export async function adminSetStakeholderVerified(
  investmentId: string,
  adminId: string,
  verified: boolean,
): Promise<void> {
  const id = String(investmentId ?? "").trim();
  const actor = String(adminId ?? "").trim();
  if (!id) throw new Error("Missing investment id.");
  if (!actor) throw new Error("Missing acting admin id.");

  // (1) Resolve the investment → its owner stakeholderId.
  const existing = await prisma.investment.findUnique({
    where: { id },
    select: { id: true, stakeholderId: true },
  });
  if (!existing) throw new Error("Investment not found.");

  const stakeholderId = existing.stakeholderId;

  // (2) Flip the stakeholder's verifiedAt and (3) write the audit row,
  // atomically. A failed audit rolls back the verification flip.
  await prisma.$transaction(async (tx) => {
    await tx.stakeholder.update({
      where: { id: stakeholderId },
      data: { verifiedAt: verified ? new Date() : null },
    });
    await tx.auditLog.create({
      data: {
        investmentId: existing.id,
        action: verified ? "VERIFY_STAKEHOLDER" : "UNVERIFY_STAKEHOLDER",
        actor,
        detail: JSON.stringify({ stakeholderId, verified }),
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Soft-delete + restore
// ---------------------------------------------------------------------------

/**
 * Soft-delete an investment. Sets `deletedAt = now()` and writes a
 * matching `AuditLog { action: "SOFT_DELETE" }` in the same transaction.
 *
 *  - Idempotent: deleting an already-deleted row is a no-op (no duplicate
 *    audit row, returns the current row).
 *  - The row is NEVER hard-removed — `adminRestoreInvestment` is the
 *    counterpart.
 *
 * `adminId` MUST come from `getCurrentAdmin()` — never from a form field.
 *
 * Returns the (possibly updated) investment.
 */
export async function adminSoftDeleteInvestment(
  investmentId: string,
  adminId: string,
): Promise<AdminInvestmentRow> {
  const id = String(investmentId ?? "").trim();
  const actor = String(adminId ?? "").trim();
  if (!id) throw new Error("Missing investment id.");
  if (!actor) throw new Error("Missing acting admin id.");

  const existing = await prisma.investment.findUnique({
    where: { id },
    include: {
      stakeholder: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          nid: true,
          verifiedAt: true,
        },
      },
    },
  });
  if (!existing) throw new Error("Investment not found.");

  // Idempotent: already soft-deleted → don't write a second audit row.
  if (existing.deletedAt != null) {
    return {
      id: existing.id,
      uniqueId: existing.uniqueId,
      verificationCode: existing.verificationCode,
      shares: existing.shares,
      category: existing.category,
      isFoundingEntrepreneur: existing.isFoundingEntrepreneur,
      amount: numify(existing.amount),
      incentiveAmount: numify(existing.incentiveAmount),
      depositDate: existing.depositDate,
      depositMethod: existing.depositMethod,
      paymentReference: existing.paymentReference,
      notes: existing.notes,
      status: existing.status,
      confirmedAt: existing.confirmedAt,
      createdAt: existing.createdAt,
      deletedAt: existing.deletedAt,
      stakeholder: existing.stakeholder,
    };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.investment.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
      include: {
        stakeholder: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            nid: true,
            verifiedAt: true,
          },
        },
      },
    });
    await tx.auditLog.create({
      data: {
        investmentId: next.id,
        action: "SOFT_DELETE",
        actor,
        detail: JSON.stringify({
          source: "admin-soft-delete",
          uniqueId: next.uniqueId,
          previousDeletedAt: null,
        }),
      },
    });
    return next;
  });

  return {
    id: updated.id,
    uniqueId: updated.uniqueId,
    verificationCode: updated.verificationCode,
    shares: updated.shares,
    category: updated.category,
    isFoundingEntrepreneur: updated.isFoundingEntrepreneur,
    amount: numify(updated.amount),
    incentiveAmount: numify(updated.incentiveAmount),
    depositDate: updated.depositDate,
    depositMethod: updated.depositMethod,
    paymentReference: updated.paymentReference,
    notes: updated.notes,
    status: updated.status,
    confirmedAt: updated.confirmedAt,
    createdAt: updated.createdAt,
    deletedAt: updated.deletedAt,
    stakeholder: updated.stakeholder,
  };
}

/**
 * Restore a previously soft-deleted investment. Sets `deletedAt = null`
 * and writes a matching `AuditLog { action: "RESTORE" }` in the same
 * transaction.
 *
 *  - Idempotent: restoring an already-active row is a no-op (no duplicate
 *    audit row, returns the current row).
 *  - Counterpart to `adminSoftDeleteInvestment`. The row was never hard-
 *    removed, so this is just a flip of the `deletedAt` column.
 *
 * `adminId` MUST come from `getCurrentAdmin()` — never from a form field.
 *
 * Returns the (possibly updated) investment.
 */
export async function adminRestoreInvestment(
  investmentId: string,
  adminId: string,
): Promise<AdminInvestmentRow> {
  const id = String(investmentId ?? "").trim();
  const actor = String(adminId ?? "").trim();
  if (!id) throw new Error("Missing investment id.");
  if (!actor) throw new Error("Missing acting admin id.");

  const existing = await prisma.investment.findUnique({
    where: { id },
    include: {
      stakeholder: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          nid: true,
          verifiedAt: true,
        },
      },
    },
  });
  if (!existing) throw new Error("Investment not found.");

  // Idempotent: already active (deletedAt == null) → no-op, no audit row.
  if (existing.deletedAt == null) {
    return {
      id: existing.id,
      uniqueId: existing.uniqueId,
      verificationCode: existing.verificationCode,
      shares: existing.shares,
      category: existing.category,
      isFoundingEntrepreneur: existing.isFoundingEntrepreneur,
      amount: numify(existing.amount),
      incentiveAmount: numify(existing.incentiveAmount),
      depositDate: existing.depositDate,
      depositMethod: existing.depositMethod,
      paymentReference: existing.paymentReference,
      notes: existing.notes,
      status: existing.status,
      confirmedAt: existing.confirmedAt,
      createdAt: existing.createdAt,
      deletedAt: existing.deletedAt,
      stakeholder: existing.stakeholder,
    };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.investment.update({
      where: { id: existing.id },
      data: { deletedAt: null },
      include: {
        stakeholder: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            nid: true,
            verifiedAt: true,
          },
        },
      },
    });
    await tx.auditLog.create({
      data: {
        investmentId: next.id,
        action: "RESTORE",
        actor,
        detail: JSON.stringify({
          source: "admin-restore",
          uniqueId: next.uniqueId,
        }),
      },
    });
    return next;
  });

  return {
    id: updated.id,
    uniqueId: updated.uniqueId,
    verificationCode: updated.verificationCode,
    shares: updated.shares,
    category: updated.category,
    isFoundingEntrepreneur: updated.isFoundingEntrepreneur,
    amount: numify(updated.amount),
    incentiveAmount: numify(updated.incentiveAmount),
    depositDate: updated.depositDate,
    depositMethod: updated.depositMethod,
    paymentReference: updated.paymentReference,
    notes: updated.notes,
    status: updated.status,
    confirmedAt: updated.confirmedAt,
    createdAt: updated.createdAt,
    deletedAt: updated.deletedAt,
    stakeholder: updated.stakeholder,
  };
}

// ---------------------------------------------------------------------------
// Update (admin edit)
// ---------------------------------------------------------------------------

/**
 * Admin-only edit of an investment + its stakeholder.
 *
 *  - Editable fields: shares, isFoundingEntrepreneur, depositDate,
 *    depositMethod, paymentReference, notes, and the stakeholder's
 *    name/phone/email/nid.
 *  - When `shares` or `isFoundingEntrepreneur` change, RECOMPUTE category,
 *    amount, incentiveAmount server-side (never trust client values).
 *  - Refuses to edit the immutable fields (uniqueId, verificationCode,
 *    createdAt, status — status is flipped via adminConfirmInvestment).
 *  - All writes + audit happen in one transaction.
 *
 * Returns the updated row (with BigInt coerced to Number) on success.
 */
export async function adminUpdateInvestment(
  investmentId: string,
  adminId: string,
  data: AdminInvestmentEdit,
): Promise<AdminInvestmentRow> {
  const id = String(investmentId ?? "").trim();
  const actor = String(adminId ?? "").trim();
  if (!id) throw new Error("Missing investment id.");
  if (!actor) throw new Error("Missing acting admin id.");

  const existing = await prisma.investment.findUnique({
    where: { id },
    include: {
      stakeholder: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          nid: true,
          verifiedAt: true,
        },
      },
    },
  });
  if (!existing) throw new Error("Investment not found.");

  // ---- 1. Build the investment patch --------------------------------
  // Only set fields the admin actually sent. Anything omitted is left
  // alone. We deliberately snapshot "before" so the audit log can report
  // exactly which fields changed.
  const before = {
    shares: existing.shares,
    isFoundingEntrepreneur: existing.isFoundingEntrepreneur,
    category: existing.category,
    amount: numify(existing.amount),
    incentiveAmount: numify(existing.incentiveAmount),
    depositDate: existing.depositDate,
    depositMethod: existing.depositMethod,
    paymentReference: existing.paymentReference,
    notes: existing.notes,
    stakeholder: {
      name: existing.stakeholder.name,
      phone: existing.stakeholder.phone,
      email: existing.stakeholder.email,
      nid: existing.stakeholder.nid,
    },
  };

  const investPatch: Prisma.InvestmentUpdateInput = {};
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  if (typeof data.shares === "number" && data.shares !== existing.shares) {
    if (data.shares < 1 || data.shares > 100 || !Number.isInteger(data.shares)) {
      throw new Error("Shares must be a whole number between 1 and 100.");
    }
    investPatch.shares = data.shares;
    changes.shares = { from: existing.shares, to: data.shares };
  }

  if (
    typeof data.isFoundingEntrepreneur === "boolean" &&
    data.isFoundingEntrepreneur !== existing.isFoundingEntrepreneur
  ) {
    investPatch.isFoundingEntrepreneur = data.isFoundingEntrepreneur;
    changes.isFoundingEntrepreneur = {
      from: existing.isFoundingEntrepreneur,
      to: data.isFoundingEntrepreneur,
    };
  }

  // If either of the financial triggers changed, we MUST recompute the
  // derived fields. Otherwise we leave the stored values alone.
  const financialTouched =
    changes.shares !== undefined || changes.isFoundingEntrepreneur !== undefined;
  if (financialTouched) {
    const nextShares =
      typeof data.shares === "number" ? data.shares : existing.shares;
    const nextFounding =
      typeof data.isFoundingEntrepreneur === "boolean"
        ? data.isFoundingEntrepreneur
        : existing.isFoundingEntrepreneur;

    const nextCategory: ShareCategoryType = categoryFor(nextShares);
    const nextAmount = amountFor(nextShares);
    const nextIncentive = incentiveFor(nextShares, nextFounding);

    investPatch.category = nextCategory as ShareCategory;
    investPatch.amount = BigInt(nextAmount);
    investPatch.incentiveAmount = BigInt(nextIncentive);

    if (nextCategory !== existing.category) {
      changes.category = { from: existing.category, to: nextCategory };
    }
    if (nextAmount !== numify(existing.amount)) {
      changes.amount = { from: numify(existing.amount), to: nextAmount };
    }
    if (nextIncentive !== numify(existing.incentiveAmount)) {
      changes.incentiveAmount = {
        from: numify(existing.incentiveAmount),
        to: nextIncentive,
      };
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, "depositDate")) {
    investPatch.depositDate = data.depositDate ?? null;
    if (!sameDate(existing.depositDate, data.depositDate ?? null)) {
      changes.depositDate = {
        from: existing.depositDate,
        to: data.depositDate ?? null,
      };
    }
  }
  if (Object.prototype.hasOwnProperty.call(data, "depositMethod")) {
    investPatch.depositMethod = data.depositMethod ?? null;
    if ((existing.depositMethod ?? null) !== (data.depositMethod ?? null)) {
      changes.depositMethod = {
        from: existing.depositMethod,
        to: data.depositMethod ?? null,
      };
    }
  }
  if (Object.prototype.hasOwnProperty.call(data, "paymentReference")) {
    investPatch.paymentReference = data.paymentReference ?? null;
    if (
      (existing.paymentReference ?? null) !== (data.paymentReference ?? null)
    ) {
      changes.paymentReference = {
        from: existing.paymentReference,
        to: data.paymentReference ?? null,
      };
    }
  }
  if (Object.prototype.hasOwnProperty.call(data, "notes")) {
    investPatch.notes = data.notes ?? null;
    if ((existing.notes ?? null) !== (data.notes ?? null)) {
      changes.notes = { from: existing.notes, to: data.notes ?? null };
    }
  }

  // ---- 2. Build the stakeholder patch (only if at least one field sent)
  const stakeholderPatch: Prisma.StakeholderUpdateInput = {};
  if (data.stakeholder) {
    const s = data.stakeholder;
    if (
      typeof s.name === "string" &&
      s.name.trim().length > 0 &&
      s.name !== existing.stakeholder.name
    ) {
      stakeholderPatch.name = s.name.trim();
      changes["stakeholder.name"] = {
        from: existing.stakeholder.name,
        to: s.name.trim(),
      };
    }
    if (Object.prototype.hasOwnProperty.call(s, "phone")) {
      const next = s.phone?.trim() || null;
      if ((existing.stakeholder.phone ?? null) !== next) {
        stakeholderPatch.phone = next;
        changes["stakeholder.phone"] = {
          from: existing.stakeholder.phone,
          to: next,
        };
      }
    }
    if (Object.prototype.hasOwnProperty.call(s, "email")) {
      const next = s.email?.trim().toLowerCase() || null;
      if ((existing.stakeholder.email ?? null) !== next) {
        stakeholderPatch.email = next;
        changes["stakeholder.email"] = {
          from: existing.stakeholder.email,
          to: next,
        };
      }
    }
    if (Object.prototype.hasOwnProperty.call(s, "nid")) {
      const next = s.nid?.trim() || null;
      if ((existing.stakeholder.nid ?? null) !== next) {
        stakeholderPatch.nid = next;
        changes["stakeholder.nid"] = {
          from: existing.stakeholder.nid,
          to: next,
        };
      }
    }
  }

  const noChanges =
    Object.keys(investPatch).length === 0 &&
    Object.keys(stakeholderPatch).length === 0;

  // No-op edits still return the current row without writing an audit log —
  // we don't want a flood of empty EDIT rows.
  if (noChanges) {
    return {
      id: existing.id,
      uniqueId: existing.uniqueId,
      verificationCode: existing.verificationCode,
      shares: existing.shares,
      category: existing.category,
      isFoundingEntrepreneur: existing.isFoundingEntrepreneur,
      amount: numify(existing.amount),
      incentiveAmount: numify(existing.incentiveAmount),
      depositDate: existing.depositDate,
      depositMethod: existing.depositMethod,
      paymentReference: existing.paymentReference,
      notes: existing.notes,
      status: existing.status,
      confirmedAt: existing.confirmedAt,
      createdAt: existing.createdAt,
      deletedAt: existing.deletedAt,
      stakeholder: existing.stakeholder,
    };
  }

  // ---- 3. Atomic write + audit --------------------------------------
  const updated = await prisma.$transaction(async (tx) => {
    const nextInvest =
      Object.keys(investPatch).length > 0
        ? await tx.investment.update({
            where: { id: existing.id },
            data: investPatch,
            include: {
              stakeholder: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  nid: true,
                  verifiedAt: true,
                },
              },
            },
          })
        : existing;

    const nextStakeholder =
      Object.keys(stakeholderPatch).length > 0
        ? await tx.stakeholder.update({
            where: { id: existing.stakeholder.id },
            data: stakeholderPatch,
          })
        : existing.stakeholder;

    await tx.auditLog.create({
      data: {
        investmentId: existing.id,
        action: "EDIT",
        actor,
        detail: JSON.stringify({
          uniqueId: existing.uniqueId,
          changes,
          before,
          // Snapshot of the post-state in the same shape as `before` for
          // quick diffability in the audit viewer.
          after: {
            shares: nextInvest.shares,
            isFoundingEntrepreneur: nextInvest.isFoundingEntrepreneur,
            category: nextInvest.category,
            amount: numify(nextInvest.amount),
            incentiveAmount: numify(nextInvest.incentiveAmount),
            depositDate: nextInvest.depositDate,
            depositMethod: nextInvest.depositMethod,
            paymentReference: nextInvest.paymentReference,
            notes: nextInvest.notes,
            stakeholder: {
              name: nextStakeholder.name,
              phone: nextStakeholder.phone,
              email: nextStakeholder.email,
              nid: nextStakeholder.nid,
            },
          },
        }),
      },
    });

    return { nextInvest, nextStakeholder };
  });

  return {
    id: updated.nextInvest.id,
    uniqueId: updated.nextInvest.uniqueId,
    verificationCode: updated.nextInvest.verificationCode,
    shares: updated.nextInvest.shares,
    category: updated.nextInvest.category,
    isFoundingEntrepreneur: updated.nextInvest.isFoundingEntrepreneur,
    amount: numify(updated.nextInvest.amount),
    incentiveAmount: numify(updated.nextInvest.incentiveAmount),
    depositDate: updated.nextInvest.depositDate,
    depositMethod: updated.nextInvest.depositMethod,
    paymentReference: updated.nextInvest.paymentReference,
    notes: updated.nextInvest.notes,
    status: updated.nextInvest.status,
    confirmedAt: updated.nextInvest.confirmedAt,
    createdAt: updated.nextInvest.createdAt,
    deletedAt: updated.nextInvest.deletedAt,
    stakeholder: {
      id: updated.nextStakeholder.id,
      name: updated.nextStakeholder.name,
      email: updated.nextStakeholder.email,
      phone: updated.nextStakeholder.phone,
      nid: updated.nextStakeholder.nid,
      verifiedAt: updated.nextStakeholder.verifiedAt,
    },
  };
}

// ---------------------------------------------------------------------------
// Resend receipt
// ---------------------------------------------------------------------------

/**
 * Admin-triggered receipt resend. Real SMTP is not wired in this build, so
 * this function:
 *
 *   1. ALWAYS writes an `AuditLog { action: "RESEND_RECEIPT", actor }`
 *      so the action is recorded for posterity.
 *   2. Best-effort attempts to notify via Supabase auth (if the
 *      stakeholder has an email and Supabase is configured). Failures
 *      here are swallowed — we never want the admin click to error out
 *      because email isn't configured.
 *
 * Returns `{ logged: true, delivered: boolean }` so the UI can report a
 * soft success even when no email went out.
 */
export async function adminResendReceipt(
  investmentId: string,
  adminId: string,
): Promise<{ logged: true; delivered: boolean }> {
  const id = String(investmentId ?? "").trim();
  const actor = String(adminId ?? "").trim();
  if (!id) throw new Error("Missing investment id.");
  if (!actor) throw new Error("Missing acting admin id.");

  const investment = await prisma.investment.findUnique({
    where: { id },
    include: {
      stakeholder: {
        select: { id: true, name: true, email: true },
      },
    },
  });
  if (!investment) throw new Error("Investment not found.");

  // Step 1 — always log the intent.
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        investmentId: investment.id,
        action: "RESEND_RECEIPT",
        actor,
        detail: JSON.stringify({
          source: "admin-resend",
          uniqueId: investment.uniqueId,
          targetEmail: investment.stakeholder.email ?? null,
        }),
      },
    });
  });

  // Step 2 — best-effort delivery. We don't have SMTP wired yet, so this
  // is a placeholder that no-ops cleanly. When real transport lands,
  // replace this block with an SMTP send.
  let delivered = false;
  if (investment.stakeholder.email) {
    try {
      // Lazy import to avoid pulling supabase into the dashboard bundle.
      const { isSupabaseConfigured } = await import("@/lib/auth");
      if (isSupabaseConfigured()) {
        // Hook point for real email transport — see TODO comment below.
        // For now, we report "not delivered" so the UI can show
        // "Receipt resend logged" rather than a misleading success.
        delivered = false;
      }
    } catch (err) {
      console.warn("[admin-db] resend receipt email dispatch threw:", err);
    }
  }

  // TODO: when real SMTP / Resend / Postmark wiring ships, replace the
  // block above with the actual send call and flip `delivered` based on
  // its result. The AuditLog row is already written so the attempt is
  // recorded even if delivery itself fails later.
  return { logged: true, delivered };
}

// ---------------------------------------------------------------------------
// Create (manual add for offline-collected deposits)
// ---------------------------------------------------------------------------

/**
 * Admin-only manual create. Same shape as the public signup's server
 * action but:
 *
 *   - No OTP / Supabase email step.
 *   - `actor` on the AuditLog is the admin's id, not "self".
 *   - The admin may set `status` directly to CONFIRMED if the offline
 *     deposit is already verified — we set `confirmedAt` accordingly.
 *   - If `email` is provided AND a Stakeholder with that email already
 *     exists, the new investment is attached to that existing row
 *     (never silently overwriting the existing name/phone/nid — we
 *     merge only when the existing fields are blank).
 *
 * Uses the SAME bounded-retry-on-P2002 pattern as the public signup,
 * regenerating uniqueId/verificationCode on collision (up to 4 attempts).
 * The whole transaction (stakeholder + investment + audit) sits inside
 * the retry loop so a failed attempt rolls back cleanly.
 */
export async function adminCreateStakeholder(
  adminId: string,
  data: AdminCreateStakeholder,
): Promise<{ id: string; uniqueId: string; verificationCode: string }> {
  const actor = String(adminId ?? "").trim();
  if (!actor) throw new Error("Missing acting admin id.");

  const name = String(data.name ?? "").trim();
  if (!name) throw new Error("Shareholder name is required.");

  const shares = Math.floor(Number(data.shares));
  if (!Number.isInteger(shares) || shares < 1 || shares > 100) {
    throw new Error("Shares must be a whole number between 1 and 100.");
  }

  const email = (data.email ?? "").trim().toLowerCase() || null;
  const phone = (data.phone ?? "").trim() || null;
  const nid = (data.nid ?? "").trim() || null;
  const isFounding = Boolean(data.isFoundingEntrepreneur);
  const status: InvestmentStatus = data.status ?? InvestmentStatus.PENDING;
  const depositMethod = (data.depositMethod ?? "").trim() || null;
  const paymentReference = (data.paymentReference ?? "").trim() || null;
  const notes = (data.notes ?? "").trim() || null;

  // ---- Server-side derive — never trust client-sent values. ---------
  const category: ShareCategoryType = categoryFor(shares);
  const amount = amountFor(shares);
  const incentive = incentiveFor(shares, isFounding);

  const MAX_ID_RETRIES = 4;
  for (let attempt = 1; attempt <= MAX_ID_RETRIES; attempt++) {
    const [uniqueId, verificationCode] = await Promise.all([
      genUniqueId(),
      genVerificationCode(),
    ]);

    try {
      const result = await prisma.$transaction(async (tx) => {
        // If email was given, try to attach to an existing stakeholder
        // (merge — never silently clobber filled fields). Otherwise create.
        const existing = email
          ? await tx.stakeholder.findUnique({ where: { email } })
          : null;

        const stakeholder = existing
          ? await tx.stakeholder.update({
              where: { id: existing.id },
              data: {
                // Same merge rule as public signup: only fill blanks.
                name:
                  existing.name && existing.name.length > 0
                    ? existing.name
                    : name,
                phone: phone
                  ? existing.phone && existing.phone.length > 0
                    ? existing.phone
                    : phone
                  : existing.phone,
                nid: nid
                  ? existing.nid && existing.nid.length > 0
                    ? existing.nid
                    : nid
                  : existing.nid,
              },
            })
          : await tx.stakeholder.create({
              data: {
                name,
                email,
                phone,
                nid,
              },
            });

        const investment = await tx.investment.create({
          data: {
            stakeholderId: stakeholder.id,
            uniqueId,
            verificationCode,
            shares,
            category: category as ShareCategory,
            isFoundingEntrepreneur: isFounding,
            amount: BigInt(amount),
            incentiveAmount: BigInt(incentive),
            depositDate: data.depositDate ?? null,
            depositMethod,
            paymentReference,
            notes,
            status,
            confirmedAt:
              status === InvestmentStatus.CONFIRMED ? new Date() : null,
          },
        });

        await tx.auditLog.create({
          data: {
            investmentId: investment.id,
            action: "CREATE",
            actor,
            detail: JSON.stringify({
              source: "admin-manual-add",
              uniqueId,
              verificationCode,
              shares,
              category,
              isFoundingEntrepreneur: isFounding,
              amount,
              incentive,
              status,
              stakeholderId: stakeholder.id,
              attachedToExisting: !!existing,
            }),
          },
        });

        return {
          id: investment.id,
          uniqueId: investment.uniqueId,
          verificationCode: investment.verificationCode,
        };
      });

      return result;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const targetRaw = err.meta?.target;
        const target: string[] = Array.isArray(targetRaw)
          ? (targetRaw as string[])
          : typeof targetRaw === "string"
            ? [targetRaw]
            : [];

        if (
          target.includes("uniqueId") ||
          target.includes("verificationCode")
        ) {
          // Retry with fresh IDs.
          if (attempt < MAX_ID_RETRIES) continue;
          throw new Error(
            "Could not issue a unique ID after several retries — please try again.",
          );
        }

        if (target.includes("email")) {
          // Should not happen because we look up by email first inside the
          // transaction, but surface a clean message if it does.
          throw new Error(
            "An account with this email already exists — please use the existing record.",
          );
        }
      }
      // Non-retryable.
      console.error("[admin-db] createStakeholder transaction failed", err);
      throw err;
    }
  }

  // Unreachable — the loop either returns or throws.
  throw new Error("Could not create stakeholder.");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** BigInt → Number, with 0 for null/undefined. Safe at portal magnitudes. */
function numify(v: bigint | null | undefined): number {
  if (v == null) return 0;
  return Number(v);
}

/** Loose date equality — null/undefined and the same instant both "match". */
function sameDate(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return a.getTime() === b.getTime();
}
