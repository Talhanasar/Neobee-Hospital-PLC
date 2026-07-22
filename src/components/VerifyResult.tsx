import type { InvestmentStatus, ShareCategory } from "@prisma/client";

import {
  catClass,
  CATEGORY_LABEL,
  fmt,
  SHARE_PRICE,
  type ShareCategory as ShareCategoryType,
} from "@/lib/business";

/**
 * Public verify "v-card" — mirrors the prototype's verify-result layout
 * verbatim, using ONLY the fields the /verify page is allowed to expose.
 *
 * SECURITY: the props here are the EXACT column set selected in
 * `src/app/verify/page.tsx`. Any other field (phone, email, NID, payment
 * reference, deposit method, notes, deposit date, stakeholder id, etc.)
 * MUST NOT be added to this type or rendered. If a future stakeholder
 * feature needs more visibility, it belongs on the authenticated
 * dashboard — never on this public surface.
 */
export type PublicVerifyRecord = {
  uniqueId: string;
  verificationCode: string;
  shares: number;
  category: ShareCategoryType;
  // Pre-converted from BigInt server-side (safe at 100 shares × ৳2,00,000).
  amount: number;
  incentiveAmount: number;
  status: InvestmentStatus;
  confirmedAt: string | null; // ISO; localised in render
  stakeholder: {
    name: string;
  };
};

export default function VerifyResult({ record }: { record: PublicVerifyRecord }) {
  const isPending = record.status === "PENDING";

  const confirmedAtLabel = record.confirmedAt
    ? new Date(record.confirmedAt).toLocaleString()
    : null;

  return (
    <article
      className="rounded-2xl border border-line bg-panel p-6 sm:p-7"
      aria-label={`Verified record for ${record.stakeholder.name}`}
    >
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <h3 className="font-display text-[18px] font-bold tracking-tight">
          {record.stakeholder.name}
        </h3>
        <CategoryBadge category={record.category} />
        <StatusBadge status={record.status} />
      </div>

      <dl className="grid grid-cols-1 gap-x-3.5 gap-y-2 text-[14px] sm:grid-cols-[170px_1fr]">
        <DetailRow label="Unique ID" value={record.uniqueId} mono />
        <DetailRow
          label="Verification code"
          value={record.verificationCode}
          mono
        />
        <DetailRow
          label="Shares"
          value={`${record.shares} × ${fmt(SHARE_PRICE)}`}
          mono
        />
        <DetailRow label="Amount deposited" value={fmt(record.amount)} mono />
        {record.incentiveAmount > 0 && (
          <DetailRow
            label="Share incentive"
            value={`${fmt(record.incentiveAmount)} (bonus shares)`}
            mono
          />
        )}
        {confirmedAtLabel && (
          <DetailRow label="Confirmed on" value={confirmedAtLabel} />
        )}
      </dl>

      {isPending && (
        <div
          role="note"
          className="mt-4 rounded-[10px] bg-amber-soft px-3.5 py-3 text-[13.5px] text-amber"
        >
          This investment is pending investor confirmation.
        </div>
      )}
    </article>
  );
}

// ---------- sub-components (local — used only by the public v-card) -------

function CategoryBadge({ category }: { category: ShareCategory }) {
  // catClass() returns "share" | "premium" | "director" — same Tailwind
  // tokens used by the dashboard & landing side cards so the colour
  // treatment matches across the portal.
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
