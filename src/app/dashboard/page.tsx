import Link from "next/link";
import type { Investment } from "@prisma/client";

import { requireStakeholder } from "@/lib/auth";
import {
  catClass,
  CATEGORY_LABEL,
  fmt,
  SHARE_PRICE,
  type ShareCategory,
} from "@/lib/business";
import { getMyInvestments } from "@/lib/scoped-db";

import { confirmInvestmentAction } from "./actions";

// The dashboard renders per-request because it shows the stakeholder's own
// session + their investments. Force-dynamic avoids any chance of Next.js
// caching a personal view across users.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your shareholdings — Neobee Hospital PLC",
  description:
    "Stakeholder dashboard — review your registered investments and confirm pending shareholdings.",
};

export default async function DashboardPage() {
  // Defense-in-depth: proxy.ts also guards /dashboard/*, but every page in
  // this tree MUST start with requireStakeholder() so an accidental proxy
  // bypass or misconfiguration still bounces unauthenticated traffic to
  // /login instead of rendering personal data.
  const stakeholder = await requireStakeholder();
  const investments = await getMyInvestments();

  // Summary strip is computed from the stakeholder's own already-fetched
  // investments — no extra queries, no new data sources.
  const totalShares = investments.reduce(
    (sum, inv) => sum + Number(inv.shares),
    0
  );
  const totalAmount = investments.reduce(
    (sum, inv) => sum + Number(inv.amount),
    0
  );
  const pendingCount = investments.filter(
    (inv) => inv.status === "PENDING"
  ).length;
  const confirmedCount = investments.filter(
    (inv) => inv.status === "CONFIRMED"
  ).length;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-20 pt-7 sm:pt-9">
      {/* ---------- Page header ---------- */}
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-[640px]">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-honey-soft bg-honey-soft/70 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-honey-deep">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-honey-deep" />
            Stakeholder portal
          </div>
          <h1 className="font-display text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[34px]">
            Welcome, {stakeholder.name}
          </h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
            Your registered shareholdings in Neobee Hospital PLC. Review the
            details, confirm any pending entries, and download your digital
            money receipt.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/security"
            className="inline-flex items-center justify-center rounded-full border border-line bg-paper/70 px-5 py-2.5 text-[13px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey"
          >
            Change password
          </Link>
        </div>
      </header>

      {investments.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-6">
          {/* ---------- Summary strip ---------- */}
          <SummaryStrip
            totalShares={totalShares}
            totalAmount={totalAmount}
            pendingCount={pendingCount}
            confirmedCount={confirmedCount}
          />

          {investments.map((inv) => (
            <InvestmentCard
              key={inv.id}
              investment={inv}
              stakeholderName={stakeholder.name}
            />
          ))}
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Empty state — shown when the logged-in stakeholder has no investments yet.
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-panel p-7 text-center sm:p-10">
      {/* Soft hex motif — pure CSS/SVG, no images. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 h-[200px] w-[180px] opacity-[0.08]"
        style={{
          background:
            "conic-gradient(from 30deg, #E9A215 0 60deg, transparent 60deg 120deg, #E9A215 120deg 180deg, transparent 180deg 240deg, #E9A215 240deg 300deg, transparent 300deg)",
          clipPath:
            "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-8 -left-8 h-[110px] w-[100px] opacity-[0.07]"
        style={{
          background:
            "conic-gradient(from 30deg, #2F7D5B 0 60deg, transparent 60deg 120deg, #2F7D5B 120deg 180deg, transparent 180deg 240deg, #2F7D5B 240deg 300deg, transparent 300deg)",
          clipPath:
            "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)",
        }}
      />
      <div className="relative">
        <div className="mx-auto mb-4 inline-flex h-14 w-[50px] items-center justify-center">
          <svg viewBox="0 0 70 78" aria-hidden="true" className="h-14 w-[50px]">
            <polygon
              points="35,2 66,19 66,59 35,76 4,59 4,19"
              fill="#FBF0D6"
              stroke="#E9E4D4"
              strokeWidth="1"
            />
            <polygon
              points="35,14 56,25.5 56,52.5 35,64 14,52.5 14,25.5"
              fill="#201D12"
            />
            <text
              x="35"
              y="47"
              textAnchor="middle"
              fontFamily="var(--font-archivo), sans-serif"
              fontWeight="800"
              fontSize="22"
              fill="#E9A215"
            >
              N
            </text>
          </svg>
        </div>
        <h2 className="font-display text-[20px] font-bold tracking-tight text-ink">
          No investments yet
        </h2>
        <p className="mx-auto mt-2 max-w-[480px] text-[14px] leading-relaxed text-ink-soft">
          You don&apos;t have any registered shareholdings on this account.
          Register an investment to reserve shares and receive a unique ID,
          verification code and digital money receipt.
        </p>
        <div className="mt-5 flex justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full bg-honey px-6 py-3 font-display text-[14px] font-bold tracking-tight text-ink shadow-sm transition-colors hover:bg-[#d99408] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey-deep"
          >
            Register an investment
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Summary strip — 3 small stat tiles computed from the stakeholder's own
// already-fetched investments. No new queries.
// ---------------------------------------------------------------------------

function SummaryStrip({
  totalShares,
  totalAmount,
  pendingCount,
  confirmedCount,
}: {
  totalShares: number;
  totalAmount: number;
  pendingCount: number;
  confirmedCount: number;
}) {
  return (
    <section
      aria-label="Your shareholding summary"
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <SummaryTile
        label="Total shares"
        value={totalShares.toLocaleString("en-US")}
        hint={`across ${totalShares > 0 ? Math.max(pendingCount + confirmedCount, 1) : 0} record${pendingCount + confirmedCount === 1 ? "" : "s"}`}
        accent="honey"
      />
      <SummaryTile
        label="Total amount"
        value={fmt(totalAmount)}
        hint="all shareholdings"
        accent="neutral"
      />
      <SummaryTile
        label="Pending"
        value={pendingCount.toLocaleString("en-US")}
        hint="awaiting your confirm"
        accent="amber"
      />
      <SummaryTile
        label="Confirmed"
        value={confirmedCount.toLocaleString("en-US")}
        hint="finalised shareholdings"
        accent="green"
      />
    </section>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: "honey" | "green" | "amber" | "neutral";
}) {
  const accentRing =
    accent === "honey"
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

// ---------------------------------------------------------------------------
// Investment card — mirrors the prototype's verify-result "v-card" field set
// and status treatment. Server-rendered so BigInt fields can be safely
// converted to Number before formatting (they fit comfortably at these
// magnitudes; the largest is 100 shares × ৳2,00,000 = ৳2,00,00,000).
// ---------------------------------------------------------------------------

function InvestmentCard({
  investment,
  stakeholderName,
}: {
  investment: Investment;
  stakeholderName: string;
}) {
  // BigInt → Number is safe at these magnitudes (max ৳2 crore). We format
  // server-side so no BigInt ever crosses the server/client boundary.
  const amount = Number(investment.amount);
  const incentive = Number(investment.incentiveAmount);

  const depositDateLabel = investment.depositDate
    ? new Date(investment.depositDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

  const confirmedAtLabel = investment.confirmedAt
    ? new Date(investment.confirmedAt).toLocaleString()
    : null;

  const isPending = investment.status === "PENDING";

  // Subtle top accent stripe — honey for pending, green for confirmed.
  const topAccent = isPending
    ? "via-honey/70"
    : "via-green/70";

  return (
    <article className="relative overflow-hidden rounded-2xl border border-line bg-panel p-6 sm:p-7">
      {/* Top accent — 2px gradient bar echoing the status color. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent ${topAccent} to-transparent`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <h3 className="font-display text-[18px] font-bold tracking-tight text-ink">
          {stakeholderName}
        </h3>
        <CategoryBadge category={investment.category} />
        <StatusBadge status={investment.status} />
      </div>

      {/* Unique ID as the prominent identity — large, mono, with a tiny
          hex bullet on the left. */}
      <div className="mb-4 flex items-center gap-2.5">
        <svg
          aria-hidden="true"
          viewBox="0 0 22 24"
          className="h-[18px] w-[16px] shrink-0 text-honey-deep"
        >
          <polygon
            points="11,1 21,6.5 21,17.5 11,23 1,17.5 1,6.5"
            fill="currentColor"
            opacity="0.18"
          />
          <polygon
            points="11,5 18,8.75 18,15.25 11,19 4,15.25 4,8.75"
            fill="currentColor"
          />
        </svg>
        <span className="font-mono text-[20px] font-bold tracking-tight text-ink sm:text-[22px]">
          {investment.uniqueId}
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-[14px] sm:grid-cols-[170px_1fr]">
        <DetailRow
          label="Verification code"
          value={investment.verificationCode}
          mono
        />
        <DetailRow
          label="Shares"
          value={`${investment.shares} × ${fmt(SHARE_PRICE)}`}
          mono
        />
        <DetailRow label="Amount deposited" value={fmt(amount)} mono />
        {incentive > 0 && (
          <DetailRow
            label="Share incentive"
            value={`${fmt(incentive)} (bonus shares)`}
            mono
          />
        )}
        <DetailRow label="Deposit date" value={depositDateLabel} />
        <DetailRow
          label="Method"
          value={investment.depositMethod ?? "—"}
        />
        {investment.paymentReference && (
          <DetailRow
            label="Reference"
            value={investment.paymentReference}
            mono
          />
        )}
        {confirmedAtLabel && (
          <DetailRow label="Confirmed on" value={confirmedAtLabel} />
        )}
      </dl>

      {isPending ? (
        <>
          <form action={confirmInvestmentAction} className="mt-5">
            <input
              type="hidden"
              name="investmentId"
              value={investment.id}
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-honey px-6 py-3 font-display text-[14px] font-bold tracking-tight text-ink shadow-sm transition-colors hover:bg-[#d99408] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey-deep"
            >
              Yes, my investment details are correct — confirm
            </button>
          </form>
          <div
            role="note"
            className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-amber-soft bg-amber-soft/70 px-3.5 py-3 text-[13.5px] leading-relaxed text-amber"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="mt-0.5 h-4 w-4 shrink-0"
            >
              <path
                d="M10 2 L18 16 L2 16 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <line
                x1="10"
                y1="8"
                x2="10"
                y2="12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <circle cx="10" cy="14.2" r="0.9" fill="currentColor" />
            </svg>
            <span>
              If any detail above is wrong, do not confirm. Contact the
              finance office before confirming.
            </span>
          </div>
        </>
      ) : (
        <div
          role="status"
          className="mt-5 flex items-start gap-2.5 rounded-xl border border-green-soft bg-green-soft/70 px-3.5 py-3 text-[13.5px] leading-relaxed text-green"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="mt-0.5 h-4 w-4 shrink-0"
          >
            <circle
              cx="10"
              cy="10"
              r="8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M6 10.5 L9 13.5 L14.5 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            This shareholding has been confirmed by the investor. Thank you
            for investing in Neobee Hospital PLC.
          </span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/dashboard/receipt/${investment.uniqueId}`}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-paper transition-colors hover:bg-[#100E08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-honey"
        >
          {/* Inline receipt/hex icon */}
          <svg
            aria-hidden="true"
            viewBox="0 0 22 24"
            className="h-[14px] w-[12px]"
          >
            <polygon
              points="11,1 21,6.5 21,17.5 11,23 1,17.5 1,6.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <polygon
              points="11,5.5 17.5,9 17.5,15 11,18.5 4.5,15 4.5,9"
              fill="currentColor"
              opacity="0.35"
            />
          </svg>
          View digital receipt
        </Link>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers — kept local to keep the dashboard self-
// contained; none of them warrant a shared component yet.
// ---------------------------------------------------------------------------

function CategoryBadge({ category }: { category: ShareCategory }) {
  // catClass() returns "share" | "premium" | "director" — we reuse the
  // exact Tailwind tokens already used by SideCards.tsx and the /signup
  // side panel so the colour treatment is consistent across the portal.
  const cls = catClass(category);
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

function StatusBadge({ status }: { status: Investment["status"] }) {
  const isPending = status === "PENDING";
  const colorClass = isPending
    ? "bg-amber-soft text-amber"
    : "bg-green-soft text-green";
  const label = isPending ? "Pending confirmation" : "Confirmed";
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

function DetailRow({
  label,
  value,
  mono,
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
