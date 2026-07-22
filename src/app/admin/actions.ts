"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { InvestmentStatus } from "@prisma/client";

import { requireAdmin } from "@/lib/auth";
import {
  adminConfirmInvestment,
  adminCreateStakeholder,
  adminResendReceipt,
  adminRestoreInvestment,
  adminSetStakeholderVerified,
  adminSoftDeleteInvestment,
  adminUpdateInvestment,
} from "@/lib/admin-db";

import type {
  AdminCreateState,
  AdminEditState,
  AdminResendState,
} from "./states";

/**
 * =====================================================================
 *  Admin Server Actions
 * =====================================================================
 *
 *  Every action here calls `requireAdmin()` FIRST as defense in depth —
 *  even though the proxy middleware redirects anonymous traffic, the
 *  action surface is reachable via direct POST, so we never trust the
 *  caller. `requireAdmin()` resolves the admin row and, if the caller
 *  isn't an admin, throws a redirect to `/login?denied=1`.
 *
 *  After each mutation we `revalidatePath("/admin")` so the dashboard
 *  re-renders fresh aggregate stats and the investments table on the
 *  next request.
 * =====================================================================
 */

// ---------------------------------------------------------------------------
// State shapes for useActionState (create + edit forms) live in ./states
// because Next.js "use server" modules may only export async functions —
// the initial-state constants and types are imported from there instead.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Confirm (button on the list row + edit page)
// ---------------------------------------------------------------------------

/**
 * Confirms a PENDING investment. Idempotent — already-confirmed rows are
 * a no-op. Used both as a row-level action and from the edit page.
 */
export async function adminConfirmInvestmentAction(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("investmentId") ?? "").trim();
  if (!id) return;

  await adminConfirmInvestment(id, admin.id);
  revalidatePath("/admin");
}

// ---------------------------------------------------------------------------
// Stakeholder verification (button on the list row + detail page)
// ---------------------------------------------------------------------------

/**
 * Toggle the stakeholder verification flag on the owner of an investment.
 * Reads both `investmentId` and `verified` ("1" = verify, anything else =
 * unverify) from the form body, then delegates to `adminSetStakeholderVerified`
 * which writes a `VERIFY_STAKEHOLDER` / `UNVERIFY_STAKEHOLDER` audit row in
 * the same transaction. Used both as a row-level action on the dashboard
 * and from the investment detail page.
 */
export async function adminSetStakeholderVerifiedAction(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("investmentId") ?? "").trim();
  if (!id) return;
  const verified = String(formData.get("verified") ?? "") === "1";
  await adminSetStakeholderVerified(id, admin.id, verified);
  revalidatePath("/admin");
}

// ---------------------------------------------------------------------------
// Soft-delete + restore (button on the list row + edit page)
// ---------------------------------------------------------------------------

/**
 * Soft-deletes an investment. Idempotent — already-deleted rows are a
 * no-op (no duplicate audit row). The row is never hard-removed — the
 * counterpart `adminRestoreInvestmentAction` flips `deletedAt` back.
 * Used both as a row-level action and from the edit page.
 */
export async function adminSoftDeleteInvestmentAction(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("investmentId") ?? "").trim();
  if (!id) return;

  await adminSoftDeleteInvestment(id, admin.id);
  revalidatePath("/admin");
}

/**
 * Restores a previously soft-deleted investment. Idempotent — restoring an
 * already-active row is a no-op (no duplicate audit row). Used both as a
 * row-level action and from the edit page.
 */
export async function adminRestoreInvestmentAction(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("investmentId") ?? "").trim();
  if (!id) return;

  await adminRestoreInvestment(id, admin.id);
  revalidatePath("/admin");
}

// ---------------------------------------------------------------------------
// Resend receipt (button on the edit page)
// ---------------------------------------------------------------------------

/**
 * Logs a RESEND_RECEIPT audit row and (best-effort) attempts delivery.
 * Real SMTP isn't wired in this build — the audit row is the source of
 * truth, and the function returns a soft-success state the UI can show.
 */
export async function adminResendReceiptAction(
  _prev: AdminResendState,
  formData: FormData,
): Promise<AdminResendState> {
  const admin = await requireAdmin();
  const id = String(formData.get("investmentId") ?? "").trim();
  if (!id) {
    return {
      status: "error",
      message: "Missing investment id.",
    };
  }

  try {
    const result = await adminResendReceipt(id, admin.id);
    revalidatePath("/admin");
    return {
      status: "success",
      message: "Receipt resend logged.",
      delivered: result.delivered,
    };
  } catch (err) {
    console.error("[admin/actions] resend receipt failed", err);
    return {
      status: "error",
      message:
        err instanceof Error
          ? err.message
          : "Could not log the receipt resend.",
    };
  }
}

// ---------------------------------------------------------------------------
// Create (manual add form)
// ---------------------------------------------------------------------------

/**
 * Manual add for offline-collected deposits. No OTP, no Supabase dispatch.
 * Validates inputs, recomputes derived fields server-side, and creates
 * the stakeholder + investment + audit row in one transaction.
 */
export async function adminCreateStakeholderAction(
  _prev: AdminCreateState,
  formData: FormData,
): Promise<AdminCreateState> {
  const admin = await requireAdmin();

  // ---- 1. Pull + validate ----------------------------------------------
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const nid = String(formData.get("nid") ?? "").trim();
  const sharesRaw = parseInt10(formData.get("shares"));
  const isFoundingEntrepreneur =
    String(formData.get("isFoundingEntrepreneur") ?? "") === "on";
  const depositDate = parseDate(formData.get("depositDate"));
  const depositMethod = String(formData.get("depositMethod") ?? "").trim();
  const paymentReference = String(
    formData.get("paymentReference") ?? "",
  ).trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "PENDING").trim();
  const status: InvestmentStatus =
    statusRaw === "CONFIRMED"
      ? InvestmentStatus.CONFIRMED
      : InvestmentStatus.PENDING;

  const fieldErrors: Record<string, string> = {};

  if (!name) fieldErrors.name = "Shareholder name is required.";

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "That doesn't look like a valid email address.";
  }

  if (sharesRaw == null) {
    fieldErrors.shares = "Enter a whole number of shares.";
  } else if (sharesRaw < 1 || sharesRaw > 100) {
    fieldErrors.shares = "Shares must be between 1 and 100.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fix the highlighted fields and try again.",
      fieldErrors,
    };
  }

  try {
    const result = await adminCreateStakeholder(admin.id, {
      name,
      email: email || null,
      phone: phone || null,
      nid: nid || null,
      shares: sharesRaw as number,
      isFoundingEntrepreneur,
      depositDate,
      depositMethod: depositMethod || null,
      paymentReference: paymentReference || null,
      notes: notes || null,
      status,
    });
    revalidatePath("/admin");

    return {
      status: "success",
      uniqueId: result.uniqueId,
      verificationCode: result.verificationCode,
      message:
        status === InvestmentStatus.CONFIRMED
          ? `Saved and marked as CONFIRMED — ${result.uniqueId}`
          : `Saved as PENDING — ${result.uniqueId}`,
    };
  } catch (err) {
    console.error("[admin/actions] createStakeholder failed", err);
    return {
      status: "error",
      message:
        err instanceof Error
          ? err.message
          : "Could not save the stakeholder. Please try again.",
    };
  }
}

// ---------------------------------------------------------------------------
// Update (edit form on the detail page)
// ---------------------------------------------------------------------------

/**
 * Edit a single investment + its stakeholder. Only fields present in the
 * form are applied; everything else is left untouched. Derived fields
 * (category, amount, incentive) are recomputed server-side when shares or
 * isFoundingEntrepreneur change.
 */
export async function adminUpdateInvestmentAction(
  _prev: AdminEditState,
  formData: FormData,
): Promise<AdminEditState> {
  const admin = await requireAdmin();
  const id = String(formData.get("investmentId") ?? "").trim();
  if (!id) {
    return { status: "error", message: "Missing investment id." };
  }

  const fieldErrors: Record<string, string> = {};

  // ---- 1. Pull + validate ---------------------------------------------
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const nid = String(formData.get("nid") ?? "").trim();

  const sharesRaw = parseInt10(formData.get("shares"));
  const isFoundingEntrepreneur =
    String(formData.get("isFoundingEntrepreneur") ?? "") === "on";

  const depositDate = parseDate(formData.get("depositDate"));
  const depositMethod = String(formData.get("depositMethod") ?? "").trim();
  const paymentReference = String(
    formData.get("paymentReference") ?? "",
  ).trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) fieldErrors.name = "Shareholder name is required.";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "That doesn't look like a valid email address.";
  }
  if (sharesRaw != null && (sharesRaw < 1 || sharesRaw > 100)) {
    fieldErrors.shares = "Shares must be between 1 and 100.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fix the highlighted fields and try again.",
      fieldErrors,
    };
  }

  // ---- 2. Apply patch --------------------------------------------------
  // We send every editable field; admin-db decides what actually changed
  // and writes the audit row only on a real diff.
  try {
    await adminUpdateInvestment(id, admin.id, {
      shares: sharesRaw ?? undefined,
      isFoundingEntrepreneur,
      depositDate,
      depositMethod: depositMethod || null,
      paymentReference: paymentReference || null,
      notes: notes || null,
      stakeholder: {
        name,
        phone: phone || null,
        email: email || null,
        nid: nid || null,
      },
    });
    revalidatePath("/admin");
    revalidatePath(`/admin/${id}`);
    return {
      status: "success",
      message: "Changes saved.",
    };
  } catch (err) {
    console.error("[admin/actions] updateInvestment failed", err);
    return {
      status: "error",
      message:
        err instanceof Error
          ? err.message
          : "Could not save the changes. Please try again.",
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseInt10(raw: FormDataEntryValue | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (!/^-?\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: FormDataEntryValue | null): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Re-export redirect for the "back to dashboard" button on sub-pages.
// (Inline <Link> covers the common case; this is for form-based cancel.)
// ---------------------------------------------------------------------------

export async function adminBackToDashboardAction(): Promise<void> {
  // requireAdmin() so the action isn't callable from a non-admin session.
  await requireAdmin();
  redirect("/admin");
}
