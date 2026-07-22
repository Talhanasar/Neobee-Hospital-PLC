import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { extractCode } from "@/lib/business";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import VerifyForm from "@/components/VerifyForm";
import VerifyResult, { type PublicVerifyRecord } from "@/components/VerifyResult";
import VerifyNotFound from "@/components/VerifyNotFound";

// PUBLIC ROUTE. Anyone can verify a code/UID — no auth required. The
// proxy.ts middleware deliberately does NOT list `/verify` under
// PROTECTED_PREFIXES (it only guards /dashboard and /admin), so an
// unauthenticated visitor reaches this page directly.
export const dynamic = "force-dynamic"; // searchParams → request-time

export const metadata: Metadata = {
  title: "Verify your investment — Neobee Hospital PLC",
  description:
    "Look up a Neobee Hospital PLC investment by its verification code (NB-XXXXXX) or unique ID (NEO-####).",
};

// ---------------------------------------------------------------------------
// Strict public select — this is the SECURITY CONTRACT for /verify.
//
// Only the columns listed below may leave the DB on this route. PII
// (phone, email, NID, payment reference, deposit method, deposit date,
// notes, stakeholder id, audit logs, etc.) must NEVER be selected here.
// If a future feature needs more visibility it belongs on the
// authenticated dashboard, NOT on this public surface.
// ---------------------------------------------------------------------------
const PUBLIC_SELECT = {
  uniqueId: true,
  verificationCode: true,
  shares: true,
  category: true,
  amount: true,
  incentiveAmount: true,
  status: true,
  confirmedAt: true,
  stakeholder: { select: { name: true } },
} as const;

type RawRecord = {
  uniqueId: string;
  verificationCode: string;
  shares: number;
  category: "SHAREHOLDER" | "PREMIUM" | "DIRECTOR";
  amount: bigint;
  incentiveAmount: bigint;
  status: "PENDING" | "CONFIRMED";
  confirmedAt: Date | null;
  stakeholder: { name: string };
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;

  // Accept both `?q=` (the form posts `q`) and `?code=` (for future deep-
  // link / QR URL usage). Either key works; the prototype's QR string is
  // pipe-delimited, so the manual-entry path remains the primary route.
  const raw = pickFirst(sp.q) ?? pickFirst(sp.code) ?? "";

  const trimmedRaw = raw.trim();
  const defaultFormValue = trimmedRaw;

  // No query yet → render only the form. (Don't even hint at a not-found
  // state — there's nothing to look up.)
  if (!trimmedRaw) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20 pt-7">
          <VerifyHeading />
          <VerifyForm defaultValue={defaultFormValue} />
        </main>
        <SiteFooter />
      </>
    );
  }

  // Run the lookup. Any DB error (DB unreachable during build, etc.) is
  // treated as "no record found" — we MUST NOT leak driver errors to a
  // public page.
  const result = await safeLookup(trimmedRaw);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20 pt-7">
        <VerifyHeading />
        <VerifyForm defaultValue={defaultFormValue} />
        <div className="mt-6">
          {result.kind === "match" ? (
            <VerifyResult record={result.record} />
          ) : (
            <VerifyNotFound identifier={result.identifier} />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

// ---------------------------------------------------------------------------
// Heading + subtitle block — kept inline so the page composition is a single
// glance. Copy is verbatim from the build spec.
// ---------------------------------------------------------------------------
function VerifyHeading() {
  return (
    <header className="mb-6">
      <h1 className="mb-1.5 font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em]">
        Verify your investment
      </h1>
      <p className="max-w-[640px] text-[14.5px] text-ink-soft">
        Scan the QR on your receipt with any phone camera, then enter the code
        shown — or type your unique ID — to check your shareholding and
        confirm the record is correct.
      </p>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Lookup helper.
//
// We use the existing `extractCode` from `@/lib/business` (which is a
// verbatim port of the prototype's `extractCode`) to decide whether to
// query by `verificationCode` or by `uniqueId`. The actual DB query uses
// a strict `select` so PII never leaves the database. BigInt fields are
// converted to Number on the server (safe at 100 shares × ৳2,00,000 =
// ৳2,00,00,000) before being passed to the result component.
// ---------------------------------------------------------------------------
async function safeLookup(
  raw: string,
): Promise<
  | { kind: "match"; record: PublicVerifyRecord }
  | { kind: "notfound"; identifier: string }
> {
  const parsed = extractCode(raw);
  // Identifier echoed back to the user on miss — prefer the more specific
  // match, else fall back to the trimmed raw input.
  const identifier = parsed.code ?? parsed.uid ?? raw.trim();

  let row: RawRecord | null = null;
  try {
    if (parsed.code) {
      // NOTE: `findUnique` only accepts unique fields in `where`, so we
      // can't AND a `deletedAt: null` clause through it. We switch to
      // `findFirst` (which honours arbitrary where filters) and AND the
      // unique key + the not-deleted predicate. The DB still uses the
      // unique index on verificationCode, so this is not a perf regression.
      row = await prisma.investment.findFirst({
        where: { verificationCode: parsed.code, deletedAt: null },
        select: PUBLIC_SELECT,
      });
    } else if (parsed.uid) {
      row = await prisma.investment.findFirst({
        where: { uniqueId: parsed.uid, deletedAt: null },
        select: PUBLIC_SELECT,
      });
    } else {
      // extractCode() always returns either code or uid, but be defensive.
      return { kind: "notfound", identifier };
    }
  } catch (err) {
    // Don't leak driver errors to a public page — log server-side and
    // surface a generic not-found.
    console.warn("[verify] lookup failed:", err);
    return { kind: "notfound", identifier };
  }

  if (!row) return { kind: "notfound", identifier };

  // BigInt → Number on the server. Max realistic value at 100 shares is
  // ৳2 crore (well within Number.MAX_SAFE_INTEGER).
  const record: PublicVerifyRecord = {
    uniqueId: row.uniqueId,
    verificationCode: row.verificationCode,
    shares: row.shares,
    category: row.category,
    amount: Number(row.amount),
    incentiveAmount: Number(row.incentiveAmount),
    status: row.status,
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
    stakeholder: { name: row.stakeholder.name },
  };
  return { kind: "match", record };
}

/** Pull a single string value out of a searchParams entry. */
function pickFirst(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
