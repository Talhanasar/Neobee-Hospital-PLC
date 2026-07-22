import Link from "next/link";
import type { ShareCategory } from "@prisma/client";

import { requireAdmin } from "@/lib/auth";
import {
  catClass,
  CATEGORY_LABEL,
  fmt,
  FOUNDING_SUBTARGET,
  PROJECT_TARGET,
  type ShareCategory as ShareCategoryType,
} from "@/lib/business";
import {
  getAdminStats,
  listInvestments,
  type AdminInvestmentRow,
} from "@/lib/admin-db";
import type { InvestmentStatus } from "@prisma/client";

import AdminFilters from "./AdminFilters";
import AdminRowActionButton from "./AdminRowActionButton";
import {
  adminConfirmInvestmentAction,
  adminRestoreInvestmentAction,
  adminSetStakeholderVerifiedAction,
  adminSoftDeleteInvestmentAction,
} from "./actions";

// Admin views are per-request and depend on the admin's session + the
// current DB state — never cache across users.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin dashboard — Neobee Hospital PLC",
  description:
    "Admin view of investments, stakeholder registrations, and the project raise progress.",
};

// ---------- searchParams type (Next.js 16: prop is a Promise) -------------
type SearchParams = Promise<{
  search?: string | string[];
  category?: string | string[];
  status?: string | string[];
  deleted?: string | string[];
}>;

function pickScalar(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // 1. Auth gate. Bounces non-admins to /login?denied=1 (defense-in-depth —
  //    proxy.ts already enforces "logged in", this enforces "is an admin").
  const admin = await requireAdmin();

  // 2. Parse filters. searchParams is a plain object per the Next 16 docs,
  //    so we can read it after awaiting.
  const sp = await searchParams;
  const search = (pickScalar(sp.search) ?? "").trim();
  const categoryRaw = pickScalar(sp.category) ?? "ALL";
  const statusRaw = pickScalar(sp.status) ?? "ALL";
  const deletedRaw = pickScalar(sp.deleted) ?? "active";

  const validCategory: ShareCategoryType | "ALL" =
    categoryRaw === "SHAREHOLDER" ||
    categoryRaw === "PREMIUM" ||
    categoryRaw === "DIRECTOR"
      ? categoryRaw
      : "ALL";
  const validStatus: InvestmentStatus | "ALL" =
    statusRaw === "PENDING" || statusRaw === "CONFIRMED" ? statusRaw : "ALL";
  const validDeleted: "active" | "deleted" | "all" =
    deletedRaw === "active" ||
    deletedRaw === "deleted" ||
    deletedRaw === "all"
      ? deletedRaw
      : "active";

  // 3. Load stats + filtered investments in parallel.
  const [stats, investments] = await Promise.all([
    getAdminStats(),
    listInvestments({
      search,
      category: validCategory,
      status: validStatus,
      deleted: validDeleted,
    }),
  ]);

  const pctRaw = (stats.totalRaised / PROJECT_TARGET) * 100;
  const pct = Math.max(0, Math.min(100, pctRaw));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-20 pt-7 sm:pt-9">
        {/* ---------- Page header ---------- */}
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-[640px]">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-honey-soft bg-honey-soft/70 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-honey-deep">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-honey-deep" />
              Admin
            </div>
            <h1 className="font-display text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[34px]">
              Capital raise dashboard
            </h1>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
              Search, filter, confirm and edit every shareholding on the portal.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/add"
              className="inline-flex items-center justify-center rounded-full bg-honey px-5 py-2.5 font-display text-[13.5px] font-bold tracking-tight text-ink shadow-sm transition-colors hover:bg-[#d99408] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey-deep"
            >
              + Add stakeholder
            </Link>
            <Link
              href="/admin/security"
              className="inline-flex items-center justify-center rounded-full border border-line bg-paper/70 px-5 py-2.5 text-[13px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey"
            >
              Security
            </Link>
          </div>
        </header>

        {/* ---------- Raise progress (compact version of ProgressBanner) ---- */}
        <RaiseProgress
          totalRaised={stats.totalRaised}
          pct={pct}
          sharesSubscribed={stats.sharesSubscribed}
          slotsFilled={stats.slotsFilled}
          foundingRaised={stats.foundingRaised}
        />

        {/* ---------- Stat tiles ---------------------------------------- */}
        <section
          aria-label="Aggregate stats"
          className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <StatTile
            label="Stakeholders"
            value={stats.totalStakeholders.toLocaleString("en-US")}
            hint="unique shareholders"
          />
          <StatTile
            label="Total raised"
            value={fmt(stats.totalRaised)}
            hint={`${pct.toFixed(1)}% of ৳30,00,00,000`}
            accent="honey"
          />
          <StatTile
            label="Shares subscribed"
            value={stats.sharesSubscribed.toLocaleString("en-US")}
            hint="of 15,000"
          />
          <StatTile
            label="Entrepreneur slots"
            value={`${stats.slotsFilled} / 50`}
            hint="founding entrepreneurs"
            accent={stats.slotsFilled >= 50 ? "green" : "neutral"}
          />
        </section>

        <section
          aria-label="Pending vs confirmed"
          className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <StatTile
            label="Pending count"
            value={stats.pendingCount.toLocaleString("en-US")}
            hint={`sum ${fmt(stats.pendingSum)}`}
            accent="amber"
          />
          <StatTile
            label="Confirmed count"
            value={stats.confirmedCount.toLocaleString("en-US")}
            hint={`sum ${fmt(stats.confirmedSum)}`}
            accent="green"
          />
          <StatTile
            label="Founding raised"
            value={fmt(stats.foundingRaised)}
            hint={`of ${fmt(FOUNDING_SUBTARGET)} (৳10 crore)`}
            accent="founding"
          />
          <StatTile
            label="Avg per stakeholder"
            value={
              stats.totalStakeholders > 0
                ? fmt(Math.round(stats.totalRaised / stats.totalStakeholders))
                : fmt(0)
            }
            hint="across all shares"
          />
        </section>

        {/* ---------- Investments table --------------------------------- */}
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-display text-[14px] font-bold uppercase tracking-[0.06em] text-ink-soft">
                Investments
              </div>
              <p className="mt-1 text-[13px] text-ink-soft">
                {investments.length.toLocaleString("en-US")} row
                {investments.length === 1 ? "" : "s"}
                {search && (
                  <>
                    {" "}matching <b className="text-ink">{search}</b>
                  </>
                )}
                {validCategory !== "ALL" && (
                  <>
                    {" "}in <b className="text-ink">{CATEGORY_LABEL[validCategory as ShareCategoryType]}</b>
                  </>
                )}
                {validStatus !== "ALL" && (
                  <>
                    {" "}— <b className="text-ink">{validStatus.toLowerCase()}</b>
                  </>
                )}
                .
              </p>
            </div>
          </div>

          <div className="mb-4">
            <AdminFilters
              initialSearch={search}
              initialCategory={validCategory}
              initialStatus={validStatus}
              initialDeleted={validDeleted}
            />
          </div>

          <InvestmentsTable rows={investments} />
        </section>
      </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Compact raise-progress banner. Echoes the landing ProgressBanner
 * (dark-ink card, hex accent corner, green progress bar) but tightens
 * the layout for the admin context where the stat tiles already convey
 * most of the same numbers.
 */
function RaiseProgress({
  totalRaised,
  pct,
  sharesSubscribed,
  slotsFilled,
  foundingRaised,
}: {
  totalRaised: number;
  pct: number;
  sharesSubscribed: number;
  foundingRaised: number;
  slotsFilled: number;
}) {
  const pctRounded = Math.round(pct);
  return (
    <section
      aria-label="Project raise progress"
      className="relative overflow-hidden rounded-2xl bg-ink p-5 text-paper sm:p-6"
    >
      {/* Hex accent — same conic-gradient clipPath trick as ProgressBanner. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-10 h-[200px] w-[180px] opacity-[0.16]"
        style={{
          background:
            "conic-gradient(from 30deg, #E9A215 0 60deg, transparent 60deg 120deg, #E9A215 120deg 180deg, transparent 180deg 240deg, #E9A215 240deg 300deg, transparent 300deg)",
          clipPath:
            "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 -left-8 h-[120px] w-[110px] opacity-[0.10]"
        style={{
          background:
            "conic-gradient(from 30deg, #2F7D5B 0 60deg, transparent 60deg 120deg, #2F7D5B 120deg 180deg, transparent 180deg 240deg, #2F7D5B 240deg 300deg, transparent 300deg)",
          clipPath:
            "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)",
        }}
      />
      <div className="relative flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div>
          <div className="font-mono text-[10.5px] tracking-[0.16em] text-[#9F9882] uppercase">
            Raise progress
          </div>
          <h2 className="mt-1 font-display text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-paper sm:text-[24px]">
            <span className="text-honey">{fmt(totalRaised)}</span>{" "}
            <span className="text-[#CFC9B4]">of</span>{" "}
            <span className="text-honey">{fmt(PROJECT_TARGET)}</span>
          </h2>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[28px] font-extrabold leading-none tracking-[-0.02em] text-paper sm:text-[34px]">
            {pctRounded}
            <span className="text-honey">%</span>
          </span>
        </div>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuenow={pctRounded}
        aria-valuemax={100}
        aria-label="Funding progress"
        className="relative mt-4 h-3 overflow-hidden rounded-full bg-white/15"
      >
        <div
          className="h-full rounded-full bg-green transition-[width] duration-500"
          style={{
            width: `${Math.max(0, Math.min(100, pct))}%`,
            minWidth: "4px",
          }}
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[12px] text-[#CFC9B4] sm:grid-cols-4">
        <Stat label="Shares" value={sharesSubscribed.toLocaleString("en-US")} />
        <Stat
          label="Entrepreneurs"
          value={`${slotsFilled} / 50`}
        />
        <Stat
          label="Founding"
          value={`${fmt(foundingRaised)} / ${fmt(FOUNDING_SUBTARGET)}`}
        />
        <Stat label="Target" value={fmt(PROJECT_TARGET)} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:block">
      <dt className="text-[10.5px] tracking-[0.08em] text-[#9F9882] uppercase">
        {label}
      </dt>
      <dd className="font-mono text-[12.5px] font-medium text-[#EDE6CE]">
        {value}
      </dd>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "honey" | "founding" | "green" | "amber" | "neutral";
}) {
  const accentRing =
    accent === "honey" || accent === "founding"
      ? "border-l-honey"
      : accent === "green"
        ? "border-l-green"
        : accent === "amber"
          ? "border-l-amber"
          : "border-l-line";
  return (
    <div
      className={`rounded-xl border border-line border-l-[3px] ${accentRing} bg-panel px-3.5 py-3`}
    >
      <div className="font-mono text-[10.5px] tracking-[0.08em] text-ink-soft uppercase">
        {label}
      </div>
      <div className="mt-0.5 font-display text-[18px] font-bold tracking-tight">
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[11.5px] text-ink-soft">{hint}</div>
      )}
    </div>
  );
}

function InvestmentsTable({ rows }: { rows: AdminInvestmentRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-panel px-6 py-10 text-center">
        <h3 className="font-display text-[16px] font-bold tracking-tight">
          No matching investments
        </h3>
        <p className="mx-auto mt-1.5 max-w-[420px] text-[13.5px] text-ink-soft">
          Try clearing the search or filters, or add a new stakeholder for
          an offline-collected deposit.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
      <table className="min-w-full text-[13.5px]">
        <thead>
          <tr className="border-b border-line bg-neutral-soft/70 text-left font-mono text-[10.5px] tracking-[0.08em] text-ink-soft uppercase">
            <Th>Unique ID</Th>
            <Th>Shareholder</Th>
            <Th>Category</Th>
            <Th className="text-right">Shares</Th>
            <Th className="text-right">Amount</Th>
            <Th>Deposit</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isDeleted = row.deletedAt != null;
            return (
              <tr
                key={row.id}
                className={`border-b border-line/70 last:border-b-0 transition-colors hover:bg-honey-soft/30 ${
                  isDeleted ? "text-ink-soft/70 line-through decoration-ink-soft/40" : ""
                }`}
              >
                <Td>
                  <span className="font-mono text-[12.5px] font-semibold">
                    {row.uniqueId}
                  </span>
                  <div className="font-mono text-[11px] text-ink-soft">
                    {row.verificationCode}
                  </div>
                </Td>
                <Td>
                  <div className="font-semibold">{row.stakeholder.name}</div>
                  <div className="text-[11.5px] text-ink-soft">
                    {row.stakeholder.email ?? row.stakeholder.phone ?? "—"}
                  </div>
                  <div className="mt-1">
                    <VerifiedPill verifiedAt={row.stakeholder.verifiedAt} />
                  </div>
                </Td>
                <Td>
                  <CategoryBadge category={row.category} />
                  {row.isFoundingEntrepreneur && (
                    <span className="ml-1.5 inline-block rounded-md bg-honey-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-honey-deep">
                      FE
                    </span>
                  )}
                </Td>
                <Td className="text-right font-mono">{row.shares}</Td>
                <Td className="text-right font-mono font-semibold">
                  {fmt(row.amount)}
                </Td>
                <Td>
                  <DepositCell row={row} />
                </Td>
                <Td>
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={row.status} />
                    {isDeleted && <DeletedBadge />}
                  </div>
                </Td>
                <Td className="text-right">
                  <RowActions row={row} />
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DepositCell({ row }: { row: AdminInvestmentRow }) {
  const dateLabel = row.depositDate
    ? new Date(row.depositDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
  return (
    <div>
      <div className="text-[12.5px]">{dateLabel}</div>
      <div className="text-[11.5px] text-ink-soft">
        {row.depositMethod ?? "—"}
      </div>
    </div>
  );
}

function RowActions({ row }: { row: AdminInvestmentRow }) {
  const isDeleted = row.deletedAt != null;
  const isVerified = row.stakeholder.verifiedAt != null;
  return (
    <div className="inline-flex items-center gap-1.5">
      <Link
        href={`/admin/${row.id}`}
        className="inline-flex items-center justify-center rounded-md border border-line bg-paper px-2.5 py-1 text-[12px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey"
      >
        View
      </Link>
      {row.status === "PENDING" && !isDeleted && (
        <form action={adminConfirmInvestmentAction}>
          <input type="hidden" name="investmentId" value={row.id} />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-green px-2.5 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-[#266b4d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
          >
            Confirm
          </button>
        </form>
      )}
      {/* Stakeholder verify toggle — admin-only, gates stakeholder login.
          Uses an inline <form> with a second hidden `verified` field that
          AdminRowActionButton does not support. */}
      <form action={adminSetStakeholderVerifiedAction}>
        <input type="hidden" name="investmentId" value={row.id} />
        <input
          type="hidden"
          name="verified"
          value={isVerified ? "0" : "1"}
        />
        <button
          type="submit"
          className={
            isVerified
              ? "inline-flex items-center justify-center rounded-md border border-line bg-paper px-2.5 py-1 text-[12px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey"
              : "inline-flex items-center justify-center rounded-md bg-green px-2.5 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-[#266b4d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
          }
        >
          {isVerified ? "Unverify" : "Verify"}
        </button>
      </form>
      {isDeleted ? (
        <AdminRowActionButton
          action={adminRestoreInvestmentAction}
          investmentId={row.id}
          label="Restore"
          className="inline-flex items-center justify-center rounded-md border border-line bg-paper px-2.5 py-1 text-[12px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey"
        />
      ) : (
        <AdminRowActionButton
          action={adminSoftDeleteInvestmentAction}
          investmentId={row.id}
          label="Delete"
          confirmText="Delete this investment record? It can be restored later from the Deleted view."
          className="inline-flex items-center justify-center rounded-md border border-[#b3261e] bg-paper px-2.5 py-1 text-[12px] font-semibold text-[#b3261e] transition-colors hover:bg-[#fdecec] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b3261e]"
        />
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3.5 py-3 font-semibold whitespace-nowrap ${className}`}>{children}</th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3.5 py-3 align-top ${className}`}>{children}</td>;
}

function CategoryBadge({ category }: { category: ShareCategory }) {
  const cls = catClass(category);
  const colorClass =
    cls === "director"
      ? "bg-green-soft text-green"
      : cls === "premium"
        ? "bg-honey-soft text-honey-deep"
        : "bg-neutral-soft text-ink-soft";
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-[11.5px] font-semibold ${colorClass}`}
    >
      {CATEGORY_LABEL[category]}
    </span>
  );
}

function StatusBadge({ status }: { status: InvestmentStatus }) {
  const isPending = status === "PENDING";
  const colorClass = isPending
    ? "bg-amber-soft text-amber"
    : "bg-green-soft text-green";
  const label = isPending ? "Pending" : "Confirmed";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${colorClass}`}
    >
      <span
        aria-hidden="true"
        className="h-[6px] w-[6px] rounded-full bg-current"
      />
      {label}
    </span>
  );
}

/**
 * Small badge shown on rows that have been soft-deleted. Distinct from
 * the StatusBadge so admins can still see PENDING / CONFIRMED at a
 * glance — Deleted is an orthogonal state to investment status.
 */
function DeletedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-soft px-2.5 py-1 text-[11.5px] font-semibold text-ink-soft">
      <span aria-hidden="true" className="h-[6px] w-[6px] rounded-full bg-current" />
      Deleted
    </span>
  );
}

/**
 * Compact pill indicating whether the stakeholder has been admin-verified.
 * Mirrors the StatusBadge / DeletedBadge visual pattern (rounded-full,
 * small text, soft background, dot glyph) so the row stays scannable.
 * A verified stakeholder can log in; an unverified one cannot.
 */
function VerifiedPill({ verifiedAt }: { verifiedAt: Date | null }) {
  if (verifiedAt) {
    const dateLabel = new Date(verifiedAt).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-soft px-2.5 py-1 text-[11px] font-semibold text-green">
        <span
          aria-hidden="true"
          className="h-[6px] w-[6px] rounded-full bg-current"
        />
        Verified · {dateLabel}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-[11px] font-semibold text-amber">
      <span
        aria-hidden="true"
        className="h-[6px] w-[6px] rounded-full bg-current"
      />
      Unverified
    </span>
  );
}
