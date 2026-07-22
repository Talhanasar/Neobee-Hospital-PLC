import Link from "next/link";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

import AdminForgotForm from "./AdminForgotForm";

// Public auth page — per-request, never cache.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Forgot password — Admin — Neobee Hospital PLC",
  description:
    "Request a password reset link for your Neobee Hospital PLC admin account.",
};

export default async function AdminForgotPasswordPage() {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-stretch px-5 pb-16 pt-10 sm:pt-16">
        {/* Brand mark + page heading (centered hero band). */}
        <div className="mb-6 flex flex-col items-center text-center">
          <HexBrandMark />
          <h1 className="mt-5 font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
            Forgot your admin password?
          </h1>
          <p className="mt-2 max-w-[420px] text-[14px] leading-relaxed text-ink-soft">
            Enter the email tied to your administrator account. If it&apos;s on
            file, we&apos;ll send a link to set a new password.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-line bg-panel p-6 shadow-sm sm:p-7">
          <AdminForgotForm />
        </div>

        {/* Helper rail below the card */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <HelperCard title="How reset works">
            <ol className="space-y-2 text-[13px] leading-relaxed text-ink">
              <li>
                <span className="font-mono font-semibold text-honey-deep">
                  1.
                </span>{" "}
                Enter your admin email above.
              </li>
              <li>
                <span className="font-mono font-semibold text-honey-deep">
                  2.
                </span>{" "}
                Open the link we email you.
              </li>
              <li>
                <span className="font-mono font-semibold text-honey-deep">
                  3.
                </span>{" "}
                Set a new password and sign in.
              </li>
            </ol>
          </HelperCard>
          <HelperCard title="Stakeholder login">
            <p className="text-[13px] leading-relaxed text-ink-soft">
              Shareholders reset their access from the{" "}
              <Link
                href="/login"
                className="font-semibold text-honey-deep underline-offset-2 hover:underline"
              >
                shareholder login page
              </Link>{" "}
              using a one-time code.
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
        <linearGradient id="admin-forgot-hex-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBF0D6" />
          <stop offset="100%" stopColor="#FDFCF7" />
        </linearGradient>
      </defs>
      <polygon
        points="35,2 66,19 66,59 35,76 4,59 4,19"
        fill="url(#admin-forgot-hex-bg)"
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
