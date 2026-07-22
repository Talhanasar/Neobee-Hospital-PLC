import Link from "next/link";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

import ResetForm from "./ResetForm";

// Public auth page — per-request, never cache.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Set a new password — Neobee Hospital PLC",
  description:
    "Enter the 6-digit reset code we emailed you and choose a new password for your Neobee Hospital PLC stakeholder account.",
};

type SearchParams = {
  email?: string;
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { email } = await searchParams;
  const defaultEmail = email ? decodeURIComponent(email) : undefined;

  return (
    <>
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-stretch px-5 pb-16 pt-10 sm:pt-16">
        {/* Brand mark + page heading (centered hero band). */}
        <div className="mb-6 flex flex-col items-center text-center">
          <HexBrandMark />
          <h1 className="mt-5 font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
            Set a new password
          </h1>
          <p className="mt-2 max-w-[440px] text-[14px] leading-relaxed text-ink-soft">
            Paste the 6-digit code we emailed you and choose a strong
            password — at least 8 characters — to finish the reset.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-line bg-panel p-6 shadow-sm sm:p-7">
          <ResetForm defaultEmail={defaultEmail} />
        </div>

        {/* Helper rail below the card */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <HelperCard title="Code not working?">
            <p className="text-[13px] leading-relaxed text-ink-soft">
              If the code expired, request a fresh one from the{" "}
              <Link
                href="/login/forgot"
                className="font-semibold text-honey-deep underline-offset-2 hover:underline"
              >
                forgot password page
              </Link>
              .
            </p>
          </HelperCard>
          <HelperCard title="Remembered it?">
            <p className="text-[13px] leading-relaxed text-ink-soft">
              Head back to{" "}
              <Link
                href="/login"
                className="font-semibold text-honey-deep underline-offset-2 hover:underline"
              >
                sign in
              </Link>{" "}
              and use your existing password.
            </p>
          </HelperCard>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function HelperCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      <h2 className="mb-1.5 font-display text-[12px] font-bold uppercase tracking-[0.08em] text-ink-soft">
        {title}
      </h2>
      {children}
    </section>
  );
}

function HexBrandMark() {
  return (
    <svg
      viewBox="0 0 70 78"
      aria-hidden="true"
      className="h-16 w-[58px]"
    >
      <defs>
        <linearGradient
          id="stakeholder-reset-hex-bg"
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop offset="0%" stopColor="#FBF0D6" />
          <stop offset="100%" stopColor="#FDFCF7" />
        </linearGradient>
      </defs>
      <polygon
        points="35,2 66,19 66,59 35,76 4,59 4,19"
        fill="url(#stakeholder-reset-hex-bg)"
        stroke="#E9E4D4"
        strokeWidth="1"
      />
      <polygon points="35,12 56,23.5 56,54.5 35,66 14,54.5 14,23.5" fill="#201D12" />
      <text
        x="35"
        y="48"
        textAnchor="middle"
        fontFamily="var(--font-archivo), sans-serif"
        fontWeight="800"
        fontSize="22"
        fill="#E9A215"
      >
        N
      </text>
    </svg>
  );
}
