/**
 * Public "no record found" notice — verbatim copy from the prototype's
 * verify-card not-found branch. The entered identifier is rendered in a
 * mono span so users can cross-check against their receipt.
 *
 * Kept as a thin presentational component so the page composition reads
 * cleanly: {match ? <VerifyResult/> : <VerifyNotFound/>}.
 */
export default function VerifyNotFound({ identifier }: { identifier: string }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-amber bg-amber-soft px-4 py-3.5 text-[14px] leading-relaxed text-ink"
    >
      No record found for{" "}
      <span className="font-mono font-semibold">{identifier}</span>. Check the
      code on your receipt or QR slip, or contact the finance office
      (spokesperson: Mizanur Rahman).
    </div>
  );
}
