import Link from "next/link";
import { notFound } from "next/navigation";
import type { ShareCategory } from "@prisma/client";

import { requireAdmin } from "@/lib/auth";
import {
  catClass,
  CATEGORY_LABEL,
  fmt,
  type ShareCategory as ShareCategoryType,
} from "@/lib/business";
import { getInvestmentById } from "@/lib/admin-db";

import AdminEditForm from "./AdminEditForm";
import AdminRowActionButton from "../AdminRowActionButton";
import {
  adminConfirmInvestmentAction,
  adminRestoreInvestmentAction,
  adminSetStakeholderVerifiedAction,
  adminSoftDeleteInvestmentAction,
} from "../actions";

// Admin detail/edit — per-request, admin session.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit investment — Admin — Neobee Hospital PLC",
  description:
    "View and edit a stakeholder investment on the Neobee Hospital PLC portal.",
};

type Params = Promise<{ investmentId: string }>;

export default async function AdminInvestmentDetailPage({
  params,
}: {
  params: Params;
}) {
  // Defense-in-depth — proxy enforces "logged in", this enforces admin.
  await requireAdmin();

  const { investmentId } = await params;
  const inv = await getInvestmentById(investmentId);
  if (!inv) notFound();

  const isPending = inv.status === "PENDING";
  const categoryClass = catClass(inv.category as ShareCategory);

  const depositDateLabel = inv.depositDate
    ? new Date(inv.depositDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
  const confirmedAtLabel = inv.confirmedAt
    ? new Date(inv.confirmedAt).toLocaleString()
    : null;
  const createdAtLabel = new Date(inv.createdAt).toLocaleString();

  // Seed shape for the client form — flatten dates to ISO yyyy-mm-dd.
  const seed = {
    id: inv.id,
    uniqueId: inv.uniqueId,
    verificationCode: inv.verificationCode,
    shares: inv.shares,
    category: inv.category as ShareCategory,
    isFoundingEntrepreneur: inv.isFoundingEntrepreneur,
    amount: inv.amount,
    incentiveAmount: inv.incentiveAmount,
    depositDate: inv.depositDate
      ? new Date(inv.depositDate).toISOString()
      : null,
    depositMethod: inv.depositMethod,
    paymentReference: inv.paymentReference,
    notes: inv.notes,
    status: inv.status,
    stakeholder: {
      name: inv.stakeholder.name,
      phone: inv.stakeholder.phone,
      email: inv.stakeholder.email,
      nid: inv.stakeholder.nid,
    },
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20 pt-7 sm:pt-9">
      <header className="mb-7">
          <Link
            href="/admin"
            className="text-[13px] font-semibold text-ink-soft transition-colors hover:text-ink"
          >
            ← Back to dashboard
          </Link>
          <div className="mt-3 mb-4 inline-flex items-center gap-2 rounded-full border border-honey-soft bg-honey-soft/70 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-honey-deep">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-honey-deep" />
            Admin · Investment
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[30px]">
                {inv.stakeholder.name}
              </h1>
              <p className="mt-1 font-mono text-[12.5px] text-ink-soft">
                {inv.uniqueId} · {inv.verificationCode}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <CategoryBadge category={inv.category as ShareCategoryType} cls={categoryClass} />
              <StatusBadge status={inv.status} />
              {inv.deletedAt != null && <DeletedBadge />}
            </div>
          </div>
        </header>

        {/* ---- Read-only summary ---- */}
        <section className="mb-5 rounded-2xl border border-line bg-panel p-6 sm:p-7 shadow-sm">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-[14px] sm:grid-cols-[170px_1fr]">
            <Row label="Amount" value={fmt(inv.amount)} mono />
            {inv.incentiveAmount > 0 && (
              <Row
                label="Share incentive"
                value={`${fmt(inv.incentiveAmount)} (bonus shares)`}
                mono
              />
            )}
            <Row label="Deposit date" value={depositDateLabel} />
            <Row label="Deposit method" value={inv.depositMethod ?? "—"} />
            {inv.paymentReference && (
              <Row label="Reference" value={inv.paymentReference} mono />
            )}
            <Row label="Created" value={createdAtLabel} />
            {confirmedAtLabel && (
              <Row label="Confirmed at" value={confirmedAtLabel} />
            )}
            {inv.notes && (
              <Row label="Notes" value={inv.notes} />
            )}
            <Row label="Stakeholder email" value={inv.stakeholder.email ?? "—"} mono />
            <Row label="Stakeholder phone" value={inv.stakeholder.phone ?? "—"} mono />
            {inv.stakeholder.nid && (
              <Row label="NID / passport" value={inv.stakeholder.nid} mono />
            )}
          </dl>

          {isPending && (
            <form action={adminConfirmInvestmentAction} className="mt-5">
              <input type="hidden" name="investmentId" value={inv.id} />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-green px-5 py-2.5 font-display text-[13px] font-bold tracking-tight text-white shadow-sm transition-colors hover:bg-[#266b4d]"
              >
                Confirm on behalf of investor
              </button>
              <p className="mt-2 text-[12px] text-ink-soft">
                Use this when the stakeholder has already deposited offline
                and the office has verified the funds.
              </p>
            </form>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/dashboard/receipt/${inv.uniqueId}`}
              className="inline-flex items-center justify-center rounded-full border border-line bg-panel px-4 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
            >
              View digital receipt
            </Link>
            {inv.deletedAt != null ? (
              <AdminRowActionButton
                action={adminRestoreInvestmentAction}
                investmentId={inv.id}
                label="Restore investment"
                className="inline-flex items-center justify-center rounded-full border border-line bg-panel px-4 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey"
              />
            ) : (
              <AdminRowActionButton
                action={adminSoftDeleteInvestmentAction}
                investmentId={inv.id}
                label="Delete investment"
                confirmText="Delete this investment record? It can be restored later from the Deleted view."
                className="inline-flex items-center justify-center rounded-full border border-[#b3261e] bg-panel px-4 py-2 text-[13px] font-semibold text-[#b3261e] transition-colors hover:bg-[#fdecec] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b3261e]"
              />
            )}
          </div>
        </section>

        {/* ---- Stakeholder verification ---- */}
        <section className="mb-5 rounded-2xl border border-line bg-panel p-6 sm:p-7 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-[16px] font-bold tracking-tight text-ink">
                Stakeholder verification
              </h2>
              <p className="mt-1 text-[13px] text-ink-soft">
                {inv.stakeholder.verifiedAt ? (
                  <>
                    Verified since{" "}
                    <b className="text-ink">
                      {new Date(inv.stakeholder.verifiedAt).toLocaleString()}
                    </b>
                    . This stakeholder can sign in.
                  </>
                ) : (
                  <>
                    Not verified. The stakeholder cannot sign in until an
                    admin marks them verified.
                  </>
                )}
              </p>
            </div>
            <form action={adminSetStakeholderVerifiedAction} className="shrink-0">
              <input type="hidden" name="investmentId" value={inv.id} />
              <input
                type="hidden"
                name="verified"
                value={inv.stakeholder.verifiedAt ? "0" : "1"}
              />
              <button
                type="submit"
                className={
                  inv.stakeholder.verifiedAt
                    ? "inline-flex items-center justify-center rounded-full border border-line bg-panel px-4 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey"
                    : "inline-flex items-center justify-center rounded-full bg-green px-5 py-2.5 font-display text-[13px] font-bold tracking-tight text-white shadow-sm transition-colors hover:bg-[#266b4d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                }
              >
                {inv.stakeholder.verifiedAt ? "Mark unverified" : "Mark verified"}
              </button>
            </form>
          </div>
        </section>

        {/* ---- Edit form (client) ---- */}
        <div className="rounded-2xl border border-line bg-panel p-5 sm:p-7 shadow-sm">
          <AdminEditForm inv={seed} />
        </div>
      </main>
  );
}

// ---------------------------------------------------------------------------
// Presentational helpers (local to this page)
// ---------------------------------------------------------------------------

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <>
      <dt className="text-ink-soft">{label}</dt>
      <dd className={mono ? "font-mono font-medium" : "font-medium"}>
        {value}
      </dd>
    </>
  );
}

function CategoryBadge({
  category,
  cls,
}: {
  category: ShareCategoryType;
  cls: string;
}) {
  const colorClass =
    cls === "director"
      ? "bg-green-soft text-green"
      : cls === "premium"
        ? "bg-honey-soft text-honey-deep"
        : "bg-neutral-soft text-ink-soft";
  return (
    <span
      className={`inline-block rounded-md px-2.5 py-1 text-[12px] font-semibold ${colorClass}`}
    >
      {CATEGORY_LABEL[category]}
    </span>
  );
}

function StatusBadge({ status }: { status: "PENDING" | "CONFIRMED" }) {
  const isPending = status === "PENDING";
  const colorClass = isPending
    ? "bg-amber-soft text-amber"
    : "bg-green-soft text-green";
  const label = isPending ? "Pending" : "Confirmed";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${colorClass}`}
    >
      <span
        aria-hidden="true"
        className="h-[7px] w-[7px] rounded-full bg-current"
      />
      {label}
    </span>
  );
}

/**
 * Small badge shown on a detail page header for soft-deleted records.
 * Mirrors the row-level DeletedBadge in the list view so admins can
 * immediately see the row is in the "Deleted" slice.
 */
function DeletedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-soft px-2.5 py-1 text-[12px] font-semibold text-ink-soft">
      <span
        aria-hidden="true"
        className="h-[7px] w-[7px] rounded-full bg-current"
      />
      Deleted
    </span>
  );
}
