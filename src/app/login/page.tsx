import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import LoginForm from "@/app/login/LoginForm";

export const metadata = {
  title: "Log in — Neobee Hospital PLC",
  description:
    "Log in to your Neobee Hospital PLC stakeholder dashboard with your email and password.",
};

type SearchParams = {
  email?: string;
  new?: string;
  denied?: string;
  pending?: string;
  reset?: string;
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { email, new: isNew, denied, pending, reset } = await searchParams;
  const defaultEmail = email ? decodeURIComponent(email) : undefined;
  const resetSuccess = reset === "1";

  return (
    <>
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-stretch px-5 pb-16 pt-10 sm:pt-16">
        {/* Brand mark + page heading (centered hero band). */}
        <div className="mb-6 flex flex-col items-center text-center">
          <HexBrandMark />
          <h1 className="mt-5 font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
            Sign in to your account
          </h1>
          <p className="mt-2 max-w-[420px] text-[14px] leading-relaxed text-ink-soft">
            Enter your email and password to access your stakeholder dashboard.
          </p>
        </div>

        {/* Inline success notice shown after a successful password
            reset. We render it above the card (rather than inside the
            form) to keep the LoginForm component unchanged. */}
        {resetSuccess && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-green bg-green-soft px-3.5 py-2.5 text-[13px] text-ink"
          >
            Your password has been updated. Sign in with your new password.
          </div>
        )}

        {/* Card */}
        <div>
          <LoginForm
            defaultEmail={defaultEmail}
            newSignupNotice={isNew === "1"}
            deniedNotice={denied === "1"}
            pendingNotice={pending === "1"}
          />
        </div>

        {/* Helper rail below the card */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <HelperCard title="How login works">
            <ol className="space-y-2 text-[13px] leading-relaxed text-ink">
              <li>
                <span className="font-mono font-semibold text-honey-deep">
                  1.
                </span>{" "}
                Enter your email and password.
              </li>
              <li>
                <span className="font-mono font-semibold text-honey-deep">
                  2.
                </span>{" "}
                If your payment is verified by an admin, you&apos;ll reach
                your dashboard.
              </li>
              <li>
                <span className="font-mono font-semibold text-honey-deep">
                  3.
                </span>{" "}
                Forgot your password? Reset it with a one-time code.
              </li>
            </ol>
          </HelperCard>
          <HelperCard title="New here?">
            <p className="text-[13px] leading-relaxed text-ink-soft">
              If you haven&apos;t registered yet, complete the{" "}
              <Link
                href="/signup"
                className="font-semibold text-honey-deep underline-offset-2 hover:underline"
              >
                shareholder registration
              </Link>{" "}
              first. Each email is tied to a single shareholder record.
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
  // Large, centered brand mark — echoes the header hex but at hero scale.
  return (
    <svg
      viewBox="0 0 70 78"
      aria-hidden="true"
      className="h-16 w-[58px]"
    >
      <defs>
        <linearGradient id="login-hex-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBF0D6" />
          <stop offset="100%" stopColor="#FDFCF7" />
        </linearGradient>
      </defs>
      <polygon
        points="35,2 66,19 66,59 35,76 4,59 4,19"
        fill="url(#login-hex-bg)"
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
