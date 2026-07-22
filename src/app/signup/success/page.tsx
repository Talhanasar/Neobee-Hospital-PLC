import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "Registration complete — Neobee Hospital PLC",
  description:
    "Your Neobee Hospital PLC shareholder record has been saved. Check your email to confirm your account.",
};

type SearchParams = {
  uid?: string;
  code?: string;
  email?: string;
  returning?: string;
  noOtp?: string;
};

export default async function SignupSuccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { uid, code, email, returning, noOtp } = await searchParams;

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20 pt-8">
        <div className="rounded-2xl border border-line bg-panel p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full bg-green-soft text-green"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 12l4.5 4.5L19 7"
                />
              </svg>
            </span>
            <div>
              <h1 className="font-display text-[22px] font-extrabold leading-tight tracking-[-0.02em]">
                Registration saved
              </h1>
              <p className="text-[14px] text-ink-soft">
                Your shareholder record is on file. Status:{" "}
                <b className="text-ink">PENDING</b> until deposit reconciles.
              </p>
            </div>
          </div>

          {returning === "1" && (
            <div className="mb-4 rounded-lg border border-amber bg-amber-soft px-3.5 py-2.5 text-[13px] text-ink">
              We noticed this email is already on file — a new investment has
              been attached to your existing stakeholder record.
            </div>
          )}

          <dl className="divide-y divide-line rounded-xl border border-line bg-paper">
            <Row label="Unique ID">
              {uid ? (
                <span className="font-mono text-[15px] font-bold text-ink">
                  {uid}
                </span>
              ) : (
                <Missing />
              )}
            </Row>
            <Row label="Verification code">
              {code ? (
                <span className="font-mono text-[15px] font-bold text-ink">
                  {code}
                </span>
              ) : (
                <Missing />
              )}
            </Row>
            <Row label="Login email">
              {email ? (
                <span className="font-mono text-[13.5px] text-ink">{email}</span>
              ) : (
                <Missing />
              )}
            </Row>
          </dl>

          <div className="mt-6 rounded-xl border border-honey-soft bg-honey-soft/60 p-4 text-[14px] leading-relaxed">
            {noOtp === "1" ? (
              <>
                We&apos;ve saved your record, but the confirmation email
                couldn&apos;t be sent automatically (email provider not
                configured). Use the <b>Unique ID</b> and{" "}
                <b>Verification code</b> above when you reach out to the
                project team to recover access.
              </>
            ) : (
              <>
                We&apos;ve sent a confirmation email to{" "}
                {email ? (
                  <b className="font-mono">{email}</b>
                ) : (
                  "your email address"
                )}
                . Click the link in that email to confirm your address —
                your account will be activated for login once an
                administrator has verified your payment.
              </>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link
              href={email ? `/login?email=${encodeURIComponent(email)}` : "/login"}
              className="inline-flex items-center justify-center rounded-full bg-honey px-6 py-3 font-display text-[14px] font-bold tracking-tight text-ink shadow-sm transition-colors hover:bg-[#d99408]"
            >
              Continue to login
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-line bg-panel px-5 py-3 text-[14px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
            >
              Back to project
            </Link>
          </div>

          <p className="mt-6 text-[12.5px] text-ink-soft">
            Keep your <b>Unique ID</b> and <b>Verification code</b> safe —
            you&apos;ll need them to verify deposits and download receipts.
          </p>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
      <dt className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-soft">
        {label}
      </dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function Missing() {
  return <span className="text-[13px] italic text-ink-soft">Not provided</span>;
}
