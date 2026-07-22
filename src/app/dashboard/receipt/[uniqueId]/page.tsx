import "server-only";

import { notFound } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";

import { getCurrentStakeholder, requireStakeholder } from "@/lib/auth";
import {
  amountInWords,
  catClass,
  CATEGORY_LABEL,
  fmt,
  qrString,
  SHARE_PRICE,
  type ShareCategory,
} from "@/lib/business";
import { getMyInvestmentByUniqueId } from "@/lib/scoped-db";

// Receipts are per-request, personal records — never cache across users.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Digital receipt — Neobee Hospital PLC",
  description:
    "Server-generated digital money receipt for your Neobee Hospital PLC shareholding.",
};

/**
 * Server-rendered digital receipt for a single investment.
 *
 * SECURITY MODEL
 * --------------
 * 1. `requireStakeholder()` redirects unauthenticated users to /login.
 * 2. `getMyInvestmentByUniqueId()` AND-s `uniqueId` with the session's
 *    `stakeholderId` at the DB layer (see src/lib/scoped-db.ts). If the
 *    record is not owned by the current stakeholder — or doesn't exist —
 *    the call returns `null` and we `notFound()`. A stakeholder who
 *    guesses another user's NEO-#### still gets a 404, with no probe
 *    signal.
 * 3. Amount, amount-in-words, category and branding are derived from the
 *    DB record on the server. The page never reads any of those values
 *    from a client-controlled input.
 */
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ uniqueId: string }>;
}) {
  // 1. Auth gate.
  await requireStakeholder();

  // 2. Ownership-scoped fetch (DB-layer enforcement, see scoped-db.ts).
  const { uniqueId } = await params;
  const inv = await getMyInvestmentByUniqueId(uniqueId);
  if (!inv) notFound();

  // 3. Owner identity. `getMyInvestmentByUniqueId` deliberately doesn't
  //    include the `stakeholder` relation to keep the security-critical
  //    lookup path minimal and unchanged, so we resolve the current user
  //    directly. The current user IS the owner (otherwise step 2 would
  //    have returned null), so their profile is the right identity for
  //    the receipt.
  const owner = await getCurrentStakeholder();
  if (!owner) notFound();

  // BigInt → Number conversion is safe at these magnitudes: the largest
  // possible receipt is 100 shares × ৳2,00,000 = ৳2,00,00,000.
  const amount = Number(inv.amount);
  const incentive = Number(inv.incentiveAmount);

  // Format the issue / deposit date once on the server. Prefer
  // `depositDate` (the prototype prints `rec.date`), fall back to
  // `createdAt` when the deposit date hasn't been recorded yet.
  const issueDateSource = inv.depositDate ?? inv.createdAt;
  const issueDateLabel = new Date(issueDateSource).toLocaleDateString(
    "en-GB",
    { day: "2-digit", month: "short", year: "numeric" },
  );

  // Build the prototype-exact QR string and render it to a data URL on
  // the server so it's baked into the HTML (and into the PDF) — the QR
  // can never be tampered with client-side.
  const qrContent = qrString({
    verificationCode: inv.verificationCode,
    uniqueId: inv.uniqueId,
    shares: inv.shares,
    amount,
  });
  const qrDataUrl = await QRCode.toDataURL(qrContent, {
    width: 176,
    margin: 1,
    color: { dark: "#201D12", light: "#ffffff" },
  });

  const isConfirmed = inv.status === "CONFIRMED";
  const categoryClass = catClass(inv.category as ShareCategory);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-20 pt-7">
      {/* Page-level controls (not part of the receipt itself). */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-[22px] font-extrabold leading-tight tracking-[-0.02em]">
            Digital money receipt
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            Server-generated record of your shareholding. Save or download
            PDF for your files.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full border border-line bg-panel px-4 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            ← Back to dashboard
          </Link>
          <a
            href={`/dashboard/receipt/${inv.uniqueId}/pdf`}
            download={`neobee-receipt-${inv.uniqueId}.pdf`}
            className="inline-flex items-center justify-center rounded-full bg-honey px-4 py-2 font-display text-[13px] font-bold tracking-tight text-ink shadow-sm transition-colors hover:bg-[#d99408]"
          >
            Download PDF
          </a>
        </div>
      </div>

      {/* The receipt itself — mirrors the approved prototype modal layout. */}
      <article
        aria-label={`Digital money receipt ${inv.uniqueId}`}
        className="receipt overflow-hidden rounded-xl border border-line bg-panel"
      >
        {/* ---------- Header ---------- */}
        <header className="flex items-center gap-3 bg-ink px-5 py-5 text-white sm:px-6">
          <svg
            viewBox="0 0 38 42"
            aria-hidden="true"
            className="h-9 w-[34px] flex-none"
          >
            <polygon
              points="19,1 36,11 36,31 19,41 2,31 2,11"
              className="fill-honey"
            />
            <polygon
              points="19,8 30,14.5 30,27.5 19,34 8,27.5 8,14.5"
              fill="#FDFCF7"
            />
            <text
              x="19"
              y="26"
              textAnchor="middle"
              fontFamily="var(--font-archivo), sans-serif"
              fontWeight="800"
              fontSize="13"
              className="fill-honey-deep"
            >
              N
            </text>
          </svg>
          <div className="font-display text-[15px] font-extrabold leading-tight">
            Neobee Hospital PLC
            <small className="mt-0.5 block font-mono text-[9.5px] font-normal tracking-[0.16em] text-[#CFC9B4] uppercase">
              Digital money receipt
            </small>
          </div>
          <div className="ml-auto text-right font-mono text-[11px] text-[#CFC9B4]">
            Receipt / UID
            <b className="mt-0.5 block text-[13px] font-semibold text-honey">
              {inv.uniqueId}
            </b>
            <span className="mt-0.5 block">{issueDateLabel}</span>
          </div>
        </header>

        {/* ---------- Body (rows + QR column) ---------- */}
        <div className="grid grid-cols-1 gap-5 px-5 py-5 sm:px-6 md:grid-cols-[1fr_160px]">
          <div className="text-[13.5px]">
            <Row label="Received from" value={owner.name} />

            {(owner.phone || owner.email) && (
              <Row
                label="Contact"
                value={(owner.phone ?? owner.email) as string}
                mono
              />
            )}

            {owner.nid && <Row label="NID / passport" value={owner.nid} mono />}

            <Row
              label="Category"
              value={
                <CategoryBadge
                  category={inv.category as ShareCategory}
                  cls={categoryClass}
                />
              }
            />

            <Row
              label="Shares"
              value={`${inv.shares} × ${fmt(SHARE_PRICE)}`}
              mono
            />

            {incentive > 0 && (
              <Row
                label="Share incentive"
                value={`${fmt(incentive)} (bonus shares)`}
                mono
              />
            )}

            <Row
              label="Deposit method"
              value={inv.depositMethod ?? "—"}
            />

            {inv.paymentReference && (
              <Row
                label="Bank / payment reference"
                value={inv.paymentReference}
                mono
              />
            )}

            <Row
              label="Verification code"
              value={inv.verificationCode}
              mono
            />

            <Row
              label="Status"
              value={
                isConfirmed
                  ? "Confirmed by investor"
                  : "Pending investor confirmation"
              }
            />

            {/* Amount — promoted block, mirrors prototype .r-amount. */}
            <div className="mt-3 flex items-baseline justify-between gap-3 rounded-[10px] bg-honey-soft px-3.5 py-2.5">
              <span className="text-[12px] font-semibold tracking-[0.08em] text-honey-deep uppercase">
                Amount
              </span>
              <span className="font-mono text-[19px] font-semibold">
                {fmt(amount)}
              </span>
            </div>
            <div className="mt-1.5 text-[12px] italic text-ink-soft">
              {amountInWords(amount)} taka only
            </div>
          </div>

          {/* QR column */}
          <div className="text-center">
            {/* Using a regular <img> with the data URL so the QR is
                statically embedded in the HTML — no client-side JS
                needed, and the bytes match exactly what gets baked into
                the PDF. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              width={176}
              height={176}
              alt={`QR verification code for ${inv.verificationCode}`}
              className="mx-auto h-[176px] w-[176px]"
            />
            <div className="mt-1.5 inline-block rounded-md border border-dashed border-honey-deep bg-paper px-3.5 py-2 font-mono text-[12px] font-semibold tracking-[0.1em] text-ink-soft">
              {inv.verificationCode}
            </div>
            <div className="mt-1.5 text-[10.5px] leading-snug text-ink-soft">
              Scan to verify this receipt on the Neobee portal.
            </div>
          </div>
        </div>

        {/* ---------- Footer ---------- */}
        <footer className="flex flex-wrap items-start justify-between gap-2.5 border-t border-line px-5 py-3 text-[11px] text-ink-soft sm:px-6">
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-ink">Neobee Hospital PLC</span>
            <span>
              Deposits are made to the NEOBEE institutional account only.
            </span>
          </div>
          <span className="self-center">Digital services by NeoTech</span>
        </footer>
      </article>

      {/* Page-level controls (bottom) — keep both links easy to reach
          even on long receipts. Hidden in print so a printed copy is
          just the receipt. */}
      <div className="mt-5 flex flex-wrap justify-between gap-3 print:hidden">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-full border border-line bg-panel px-4 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
        >
          ← Back to dashboard
        </Link>
        <a
          href={`/dashboard/receipt/${inv.uniqueId}/pdf`}
          download={`neobee-receipt-${inv.uniqueId}.pdf`}
          className="inline-flex items-center justify-center rounded-full bg-honey px-5 py-2.5 font-display text-[13px] font-bold tracking-tight text-ink shadow-sm transition-colors hover:bg-[#d99408]"
        >
          Download PDF
        </a>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Local presentational helpers — kept inline to keep the receipt route self-
// contained. None of them need to leak into the wider app yet.
// ---------------------------------------------------------------------------

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3.5 border-b border-dashed border-line py-1.5 last:border-b-0">
      <span className="text-ink-soft">{label}</span>
      <span
        className={
          mono
            ? "text-right font-mono font-medium"
            : "text-right font-semibold"
        }
      >
        {value}
      </span>
    </div>
  );
}

function CategoryBadge({
  category,
  cls,
}: {
  category: ShareCategory;
  cls: string;
}) {
  // Reuse the dashboard's badge colour mapping so the receipt and the
  // dashboard card read as the same category.
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
