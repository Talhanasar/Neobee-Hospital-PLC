import Link from "next/link";

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { getSessionUser } from "@/lib/auth";

import AdminResetForm from "./AdminResetForm";

// Public auth page — per-request, never cache.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Set new admin password — Neobee Hospital PLC",
  description:
    "Set a new password for your Neobee Hospital PLC admin account using your reset link.",
};

export default async function AdminResetPasswordPage() {
  // We deliberately still render the form even when there's no
  // active session — the action will surface a clear "link expired"
  // error on submit. Hard-blocking here would be a worse UX (and
  // matches what the spec asked for: "keep it simple — don't
  // hard-block render").
  const session = await getSessionUser();

  return (
    <>
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-stretch px-5 pb-16 pt-10 sm:pt-16">
        {/* Brand mark + page heading (centered hero band). */}
        <div className="mb-6 flex flex-col items-center text-center">
          <HexBrandMark />
          <h1 className="mt-5 font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
            Set a new admin password
          </h1>
          <p className="mt-2 max-w-[440px] text-[14px] leading-relaxed text-ink-soft">
            {session
              ? "Choose a strong password — at least 8 characters — and confirm it below."
              : "Open the link from your reset email to set a new password."}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-line bg-panel p-6 shadow-sm sm:p-7">
          <AdminResetForm />
        </div>

        {/* Helper rail below the card */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <HelperCard title="Reset not working?">
            <p className="text-[13px] leading-relaxed text-ink-soft">
              If the link has expired, request a fresh one from the{" "}
              <Link
                href="/admin/forgot"
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
                href="/admin/login"
                className="font-semibold text-honey-deep underline-offset-2 hover:underline"
              >
                admin sign in
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
        <linearGradient id="admin-reset-hex-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBF0D6" />
          <stop offset="100%" stopColor="#FDFCF7" />
        </linearGradient>
      </defs>
      <polygon
        points="35,2 66,19 66,59 35,76 4,59 4,19"
        fill="url(#admin-reset-hex-bg)"
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
